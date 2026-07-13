import pool from '../../config/db.js';
import { assertPositiveAmount, assertStringLength, AppError, handleError } from '../../middleware/validate.js';

// ─── Startup migration — add GL link columns to bank_accounts ────────────────
(async () => {
  try {
    await pool.query(`ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS gl_account_id   UUID`);
    await pool.query(`ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS gl_account_code VARCHAR(20)`);
  } catch (err) {
    console.error('[banking] migration error:', err.message);
  }
})();

// ─── Internal helper: resolve GL account id for a bank account ───────────────
async function resolveGLAccount(client, bankAcc, tenantId) {
  if (bankAcc.gl_account_id) return bankAcc.gl_account_id;
  const code = bankAcc.account_type === 'cash' ? '1001' : '1002';
  const r = await client.query(`SELECT id FROM accounts WHERE tenant_id=$1 AND code=$2`, [tenantId, code]);
  return r.rows[0]?.id || null;
}

// ─── BANK ACCOUNTS ───────────────────────────────────────

export const createBankAccount = async (req, res) => {
  const { account_name, account_number, bank_name, account_type, current_balance } = req.body;
  const { tenantId, userId } = req.user;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Auto-generate a dedicated GL sub-account code (e.g. 1002-001, 1002-002)
    const baseCode = account_type === 'cash' ? '1001' : '1002';
    const codeCount = (await client.query(
      `SELECT COUNT(*) as cnt FROM accounts WHERE tenant_id=$1 AND code LIKE $2`,
      [tenantId, `${baseCode}-%`]
    )).rows[0].cnt;
    const glCode = `${baseCode}-${String(Number(codeCount) + 1).padStart(3, '0')}`;
    const glName = bank_name ? `${account_name} (${bank_name})` : account_name;

    // Create the dedicated GL account for this specific bank account
    const glAcct = (await client.query(
      `INSERT INTO accounts (tenant_id, code, name, type, description)
       VALUES ($1,$2,$3,'asset',$4) RETURNING id`,
      [tenantId, glCode, glName, `${account_type === 'cash' ? 'Cash' : 'Bank'} account: ${account_name}`]
    )).rows[0];

    // Create bank account record linked to the GL account
    const result = await client.query(
      `INSERT INTO bank_accounts
         (tenant_id, account_name, account_number, bank_name, account_type, current_balance, gl_account_id, gl_account_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tenantId, account_name, account_number, bank_name, account_type || 'bank',
       current_balance || 0, glAcct.id, glCode]
    );
    const bankAccount = result.rows[0];

    // Post opening balance journal entry using the dedicated GL account
    if (Number(current_balance) > 0) {
      const equityAcc = (await client.query(
        `SELECT id FROM accounts WHERE tenant_id=$1 AND code='1000'`, [tenantId]
      )).rows[0];

      const entry = (await client.query(
        `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
         VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
        [tenantId, `Opening balance — ${account_name}`, `OB-${account_name}`, userId]
      )).rows[0];

      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,0)`,
        [entry.id, glAcct.id, current_balance]
      );
      await client.query(`UPDATE accounts SET balance=balance+$1 WHERE id=$2`, [current_balance, glAcct.id]);

      if (equityAcc) {
        await client.query(
          `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,0,$3)`,
          [entry.id, equityAcc.id, current_balance]
        );
        await client.query(`UPDATE accounts SET balance=balance+$1 WHERE id=$2`, [current_balance, equityAcc.id]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json(bankAccount);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const updateBankAccount = async (req, res) => {
  const { id } = req.params;
  const { account_name, account_number, bank_name, account_type, current_balance } = req.body;
  const { tenantId, userId } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = (await client.query(
      `SELECT * FROM bank_accounts WHERE id=$1 AND tenant_id=$2`, [id, tenantId]
    )).rows[0];
    if (!existing) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Account not found' }); }

    // If balance changed, post an adjustment journal entry
    const newBalance = Number(current_balance);
    const diff = newBalance - Number(existing.current_balance);
    if (diff !== 0) {
      // Use the specific linked GL account if available, else fall back to generic code
      const glAccount = existing.gl_account_id
        ? { id: existing.gl_account_id }
        : (await client.query(
            `SELECT id FROM accounts WHERE tenant_id=$1 AND code=$2`,
            [tenantId, (account_type || existing.account_type) === 'cash' ? '1001' : '1002']
          )).rows[0];
      if (glAccount) {
        const equityAcc = (await client.query(`SELECT id FROM accounts WHERE tenant_id=$1 AND code='1000'`, [tenantId])).rows[0];
        const entry = (await client.query(
          `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
           VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
          [tenantId, `Balance adjustment — ${account_name || existing.account_name}`, `ADJ-${id}`, userId]
        )).rows[0];
        if (diff > 0) {
          // Dr Bank, Cr Owner's Capital
          await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,0)`, [entry.id, glAccount.id, diff]);
          await client.query(`UPDATE accounts SET balance=balance+$1 WHERE id=$2`, [diff, glAccount.id]);
          if (equityAcc) {
            await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,0,$3)`, [entry.id, equityAcc.id, diff]);
            await client.query(`UPDATE accounts SET balance=balance+$1 WHERE id=$2`, [diff, equityAcc.id]);
          }
        } else {
          const absDiff = Math.abs(diff);
          // Dr Owner's Capital, Cr Bank
          if (equityAcc) {
            await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,0)`, [entry.id, equityAcc.id, absDiff]);
            await client.query(`UPDATE accounts SET balance=balance-$1 WHERE id=$2`, [absDiff, equityAcc.id]);
          }
          await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,0,$3)`, [entry.id, glAccount.id, absDiff]);
          await client.query(`UPDATE accounts SET balance=balance-$1 WHERE id=$2`, [absDiff, glAccount.id]);
        }
      }
    }

    const result = await client.query(
      `UPDATE bank_accounts SET account_name=$1, account_number=$2, bank_name=$3, account_type=$4, current_balance=$5
       WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [account_name || existing.account_name, account_number ?? existing.account_number,
       bank_name ?? existing.bank_name, account_type || existing.account_type,
       newBalance, id, tenantId]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const deleteBankAccount = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `UPDATE bank_accounts SET is_active=false WHERE id=$1 AND tenant_id=$2 RETURNING id`,
      [id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getBankAccounts = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT ba.*,
        COALESCE(
          SUM(CASE WHEN bt.transaction_type = 'credit' THEN bt.amount ELSE -bt.amount END), 0
        ) as transaction_total
       FROM bank_accounts ba
       LEFT JOIN bank_transactions bt ON ba.id = bt.bank_account_id
       WHERE ba.tenant_id = $1 AND ba.is_active = true
       GROUP BY ba.id
       ORDER BY ba.account_name ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── BANK TRANSACTIONS ───────────────────────────────────

export const createTransaction = async (req, res) => {
  const { bank_account_id, transaction_date, description, amount, transaction_type, reference } = req.body;
  const { tenantId, userId } = req.user;

  const client = await pool.connect();

  try {
    assertPositiveAmount(amount, 'Transaction amount');
    assertStringLength(description, 'Description', 500);
    assertStringLength(reference, 'Reference', 100);

    await client.query('BEGIN');

    // Verify bank account belongs to this tenant
    const accCheck = (await client.query(
      `SELECT * FROM bank_accounts WHERE id=$1 AND tenant_id=$2 AND is_active=true`,
      [bank_account_id, tenantId]
    )).rows[0];
    if (!accCheck) throw new AppError('Bank account not found', 404);

    const txAmt = Math.round(Number(amount) * 100) / 100;

    // Prevent debit from pushing balance below zero (overdraft guard)
    if (transaction_type === 'debit' && Number(accCheck.current_balance) - txAmt < -0.01) {
      throw new AppError(`Insufficient balance. Available: KES ${Number(accCheck.current_balance).toLocaleString()}`);
    }

    const txResult = await client.query(
      `INSERT INTO bank_transactions (tenant_id, bank_account_id, transaction_date, description, amount, transaction_type, reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, bank_account_id, transaction_date || new Date(), description, txAmt, transaction_type, reference]
    );

    // Update bank account balance
    const balanceChange = transaction_type === 'credit' ? txAmt : -txAmt;
    await client.query(
      `UPDATE bank_accounts SET current_balance = current_balance + $1 WHERE id = $2 AND tenant_id = $3`,
      [balanceChange, bank_account_id, tenantId]
    );

    // Post to accounting — use the bank's specific linked GL account
    const bankAcc = accCheck; // already fetched above
    const glAccountId = await resolveGLAccount(client, bankAcc, tenantId);

    if (glAccountId) {
      const accountId = glAccountId;

      // Counterpart: credit (money in) clears Receivables; debit (money out) clears Payables
      const counterCode = transaction_type === 'credit' ? '1003' : '1004';
      const counterResult = await client.query(
        `SELECT id FROM accounts WHERE tenant_id=$1 AND code=$2`, [tenantId, counterCode]
      );
      const counterId = counterResult.rows[0]?.id;

      const entry = (await client.query(
        `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [tenantId, transaction_date || new Date(), description, reference || `TXN-${Date.now()}`, userId]
      )).rows[0];

      if (transaction_type === 'credit') {
        // Dr Bank (asset +), Cr Receivables (asset -)
        await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,0)`, [entry.id, accountId, amount]);
        await client.query(`UPDATE accounts SET balance=balance+$1 WHERE id=$2`, [amount, accountId]);
        if (counterId) {
          await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,0,$3)`, [entry.id, counterId, amount]);
          await client.query(`UPDATE accounts SET balance=balance-$1 WHERE id=$2`, [amount, counterId]);
        }
      } else {
        // Dr Payables (liability -), Cr Bank (asset -)
        if (counterId) {
          await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,0)`, [entry.id, counterId, amount]);
          await client.query(`UPDATE accounts SET balance=balance-$1 WHERE id=$2`, [amount, counterId]);
        }
        await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,0,$3)`, [entry.id, accountId, amount]);
        await client.query(`UPDATE accounts SET balance=balance-$1 WHERE id=$2`, [amount, accountId]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json(txResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getTransactions = async (req, res) => {
  const { tenantId } = req.user;
  const { bank_account_id } = req.query;

  try {
    let query = `
      SELECT bt.*, ba.account_name, ba.bank_name, ba.account_type
      FROM bank_transactions bt
      LEFT JOIN bank_accounts ba ON bt.bank_account_id = ba.id
      WHERE bt.tenant_id = $1
    `;
    const params = [tenantId];

    if (bank_account_id) {
      query += ` AND bt.bank_account_id = $2`;
      params.push(bank_account_id);
    }

    query += ` ORDER BY bt.transaction_date DESC, bt.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── RECONCILIATION ──────────────────────────────────────

export const reconcileTransaction = async (req, res) => {
  const { id } = req.params;
  const { reconciled_with, reconciled_id } = req.body;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `UPDATE bank_transactions
       SET is_reconciled = true, reconciled_with = $1, reconciled_id = $2
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [reconciled_with, reconciled_id, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── M-PESA TRANSACTIONS ─────────────────────────────────

export const createMpesaTransaction = async (req, res) => {
  const { transaction_id, transaction_type, phone_number, amount, direction, account_reference, description } = req.body;
  const { tenantId } = req.user;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO mpesa_transactions (tenant_id, transaction_id, transaction_type, phone_number, amount, direction, account_reference, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [tenantId, transaction_id, transaction_type, phone_number, amount, direction, account_reference, description]
    );

    // Auto post to accounting — M-Pesa settles to bank (1002), not physical cash (1001)
    // Credit (in): Dr Bank / Cr Receivables; Debit (out): Dr General Expenses / Cr Bank
    const [bankAcc, counterAcc] = await Promise.all([
      client.query(`SELECT id FROM accounts WHERE tenant_id=$1 AND code='1002'`, [tenantId]),
      client.query(`SELECT id FROM accounts WHERE tenant_id=$1 AND code=$2`, [tenantId, direction === 'in' ? '1003' : '5001']),
    ]);

    if (bankAcc.rows[0]) {
      const bankId    = bankAcc.rows[0].id;
      const counterId = counterAcc.rows[0]?.id;

      const entry = (await client.query(
        `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
         VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
        [tenantId, `M-Pesa ${direction === 'in' ? 'received' : 'sent'} — ${description}`, transaction_id, req.user.userId]
      )).rows[0];

      if (direction === 'in') {
        // Dr Bank (1002), Cr Receivables (1003)
        await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,0)`, [entry.id, bankId, amount]);
        await client.query(`UPDATE accounts SET balance=balance+$1 WHERE id=$2`, [amount, bankId]);
        if (counterId) {
          await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,0,$3)`, [entry.id, counterId, amount]);
          await client.query(`UPDATE accounts SET balance=balance-$1 WHERE id=$2`, [amount, counterId]);
        }
      } else {
        // Dr General Expenses (5001), Cr Bank (1002)
        if (counterId) {
          await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,0)`, [entry.id, counterId, amount]);
          await client.query(`UPDATE accounts SET balance=balance+$1 WHERE id=$2`, [amount, counterId]);
        }
        await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,0,$3)`, [entry.id, bankId, amount]);
        await client.query(`UPDATE accounts SET balance=balance-$1 WHERE id=$2`, [amount, bankId]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getMpesaTransactions = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT * FROM mpesa_transactions WHERE tenant_id = $1 ORDER BY transaction_date DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── BANKING SUMMARY ─────────────────────────────────────

export const getBankingSummary = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const accountsRes = await pool.query(
      `SELECT
        COUNT(*) as total_accounts,
        SUM(current_balance) as total_balance,
        SUM(CASE WHEN account_type = 'mpesa' THEN current_balance ELSE 0 END) as mpesa_balance,
        SUM(CASE WHEN account_type = 'bank'  THEN current_balance ELSE 0 END) as bank_balance,
        SUM(CASE WHEN account_type = 'cash'  THEN current_balance ELSE 0 END) as cash_balance
       FROM bank_accounts WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    );

    let summaryTotals = accountsRes.rows[0];

    // When no bank_accounts are set up yet, fall back to Chart of Accounts journal_lines totals
    if (Number(summaryTotals.total_accounts) === 0) {
      const glRes = await pool.query(`
        SELECT a.code,
          COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS balance
        FROM accounts a
        LEFT JOIN journal_lines jl ON a.id = jl.account_id
        WHERE a.tenant_id = $1 AND a.code IN ('1001', '1002')
        GROUP BY a.code
      `, [tenantId]);

      let cashBal = 0, bankBal = 0;
      for (const row of glRes.rows) {
        if (row.code === '1001') cashBal = Number(row.balance);
        if (row.code === '1002') bankBal = Number(row.balance);
      }
      summaryTotals = {
        total_accounts: '0',
        total_balance: cashBal + bankBal,
        mpesa_balance: 0,
        bank_balance: bankBal,
        cash_balance: cashBal,
      };
    }

    const transactions = await pool.query(
      `SELECT
        COUNT(*) as total_transactions,
        SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) as total_credits,
        SUM(CASE WHEN transaction_type = 'debit'  THEN amount ELSE 0 END) as total_debits,
        SUM(CASE WHEN is_reconciled = false THEN 1 ELSE 0 END) as unreconciled_count
       FROM bank_transactions WHERE tenant_id = $1`,
      [tenantId]
    );

    const mpesa = await pool.query(
      `SELECT
        COUNT(*) as total_mpesa,
        SUM(CASE WHEN direction = 'in'  THEN amount ELSE 0 END) as total_mpesa_in,
        SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as total_mpesa_out
       FROM mpesa_transactions WHERE tenant_id = $1`,
      [tenantId]
    );

    res.json({
      ...summaryTotals,
      ...transactions.rows[0],
      ...mpesa.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── INTEGRATED LEDGER ───────────────────────────────────
// Every journal entry that touched a bank/cash account (1001 or 1002)
// from ANY module — the authoritative cross-module cash-flow view.
export const getIntegratedLedger = async (req, res) => {
  const { tenantId } = req.user;
  const { from, to } = req.query;

  try {
    const params = [tenantId];
    let dateFilter = '';
    if (from) { params.push(from); dateFilter += ` AND je.date >= $${params.length}`; }
    if (to)   { params.push(to);   dateFilter += ` AND je.date <= $${params.length}`; }

    const result = await pool.query(`
      SELECT
        je.id,
        je.date        AS transaction_date,
        je.description,
        je.reference,
        je.created_at,
        a.code         AS account_code,
        a.name         AS account_name,
        jl.debit,
        jl.credit,
        CASE
          WHEN je.description ILIKE '%payment for bill%'    OR je.description ILIKE '%bill payment%'    THEN 'Payables'
          WHEN je.description ILIKE '%payment for invoice%' OR je.description ILIKE '%invoice payment%' THEN 'Receivables'
          WHEN je.description ILIKE '%opening balance%'                                                  THEN 'Opening Balance'
          WHEN je.description ILIKE '%balance adjustment%'                                               THEN 'Adjustment'
          WHEN je.description ILIKE '%stock received%'      OR je.description ILIKE '%stock issued%'    THEN 'Inventory'
          WHEN je.description ILIKE '%m-pesa%'              OR je.description ILIKE '%mpesa%'           THEN 'M-Pesa'
          WHEN je.description ILIKE '%credit note%'                                                      THEN 'Credit Note'
          WHEN je.description ILIKE '%pos sale%'                                                         THEN 'POS'
          WHEN je.description ILIKE '%payroll%'             OR je.description ILIKE '%salary%'          THEN 'Payroll'
          ELSE 'General'
        END AS source_module
      FROM journal_entries je
      JOIN journal_lines jl ON je.id = jl.journal_entry_id
      JOIN accounts      a  ON jl.account_id = a.id
      WHERE je.tenant_id = $1
        AND a.code IN ('1001', '1002')
        ${dateFilter}
      ORDER BY je.date DESC, je.created_at DESC
      LIMIT 1000
    `, params);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── SYNC BANKING FROM CHART OF ACCOUNTS ─────────────────
// Auto-creates bank_accounts from journal_lines totals when none exist.
export const syncBankingFromAccounts = async (req, res) => {
  const { tenantId } = req.user;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT COUNT(*) FROM bank_accounts WHERE tenant_id=$1 AND is_active=true`, [tenantId]
    );
    if (Number(existing.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.json({
        synced: 0,
        message: 'Bank accounts already exist. Add new ones manually in the Bank Accounts tab.',
      });
    }

    const balances = await client.query(`
      SELECT a.code,
        COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS balance
      FROM accounts a
      LEFT JOIN journal_lines jl ON a.id = jl.account_id
      WHERE a.tenant_id = $1 AND a.code IN ('1001', '1002')
      GROUP BY a.code
    `, [tenantId]);

    const created = [];
    for (const row of balances.rows) {
      const bal = Number(row.balance);
      if (bal === 0) continue;
      const accType = row.code === '1001' ? 'cash' : 'bank';
      const accName = row.code === '1001' ? 'Cash at Hand' : 'Bank Account';
      // Look up the actual GL account record to link it
      const glAcct = (await client.query(
        `SELECT id FROM accounts WHERE tenant_id=$1 AND code=$2`, [tenantId, row.code]
      )).rows[0];
      const acc = await client.query(`
        INSERT INTO bank_accounts (tenant_id, account_name, account_type, current_balance, gl_account_id, gl_account_code)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [tenantId, accName, accType, bal, glAcct?.id || null, row.code]);
      created.push(acc.rows[0]);
    }

    await client.query('COMMIT');
    res.json({ synced: created.length, accounts: created });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
// ─── TRANSACTION EDIT / DELETE ───────────────────────────
export const updateTransaction = async (req, res) => {
  const { id } = req.params;
  const { description, reference } = req.body;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `UPDATE bank_transactions SET
         description = COALESCE($1, description),
         reference   = COALESCE($2, reference)
       WHERE id=$3 AND tenant_id=$4 RETURNING *`,
      [description || null, reference || null, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteTransaction = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx = (await client.query(`SELECT * FROM bank_transactions WHERE id=$1 AND tenant_id=$2`, [id, tenantId])).rows[0];
    if (!tx) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Transaction not found' }); }

    const balanceChange = tx.transaction_type === 'credit' ? -Number(tx.amount) : Number(tx.amount);
    await client.query(`UPDATE bank_accounts SET current_balance = current_balance + $1 WHERE id=$2`, [balanceChange, tx.bank_account_id]);
    await client.query(`DELETE FROM bank_transactions WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    await client.query('COMMIT');
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const deleteMpesaTransaction = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(`DELETE FROM mpesa_transactions WHERE id=$1 AND tenant_id=$2 RETURNING id`, [id, tenantId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'M-Pesa transaction not found' });
    res.json({ message: 'M-Pesa transaction deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
