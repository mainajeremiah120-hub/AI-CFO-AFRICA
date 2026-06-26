import pool from '../../config/db.js';

// ─── BANK ACCOUNTS ───────────────────────────────────────

export const createBankAccount = async (req, res) => {
  const { account_name, account_number, bank_name, account_type, current_balance } = req.body;
  const { tenantId } = req.user;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO bank_accounts (tenant_id, account_name, account_number, bank_name, account_type, current_balance)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenantId, account_name, account_number, bank_name, account_type || 'bank', current_balance || 0]
    );
    const bankAccount = result.rows[0];

    // Post opening balance journal entry if balance > 0
    if (Number(current_balance) > 0) {
      const cashAccount = await client.query(
        `SELECT id FROM accounts WHERE tenant_id = $1 AND code = $2`,
        [tenantId, account_type === 'cash' ? '1001' : '1002']
      );

      if (cashAccount.rows[0]) {
        const entryResult = await client.query(
          `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
           VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
          [tenantId, `Opening balance — ${account_name}`, `OB-${account_name}`, req.user.userId]
        );
        const entry = entryResult.rows[0];

        await client.query(
          `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
          [entry.id, cashAccount.rows[0].id, current_balance]
        );
        await client.query(
          `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
          [current_balance, cashAccount.rows[0].id]
        );
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
      const accountCode = (account_type || existing.account_type) === 'cash' ? '1001' : '1002';
      const glAccount = (await client.query(
        `SELECT id FROM accounts WHERE tenant_id=$1 AND code=$2`, [tenantId, accountCode]
      )).rows[0];
      if (glAccount) {
        const entry = (await client.query(
          `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
           VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
          [tenantId, `Balance adjustment — ${account_name || existing.account_name}`, `ADJ-${id}`, userId]
        )).rows[0];
        if (diff > 0) {
          await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,0)`, [entry.id, glAccount.id, diff]);
          await client.query(`UPDATE accounts SET balance=balance+$1 WHERE id=$2`, [diff, glAccount.id]);
        } else {
          await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,0,$3)`, [entry.id, glAccount.id, Math.abs(diff)]);
          await client.query(`UPDATE accounts SET balance=balance-$1 WHERE id=$2`, [Math.abs(diff), glAccount.id]);
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
    await client.query('BEGIN');

    const txResult = await client.query(
      `INSERT INTO bank_transactions (tenant_id, bank_account_id, transaction_date, description, amount, transaction_type, reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, bank_account_id, transaction_date || new Date(), description, amount, transaction_type, reference]
    );

    // Update bank account balance
    const balanceChange = transaction_type === 'credit' ? Number(amount) : -Number(amount);
    await client.query(
      `UPDATE bank_accounts SET current_balance = current_balance + $1 WHERE id = $2`,
      [balanceChange, bank_account_id]
    );

    // Post to accounting
    const bankAccountResult = await client.query(
      `SELECT * FROM bank_accounts WHERE id = $1`, [bank_account_id]
    );
    const bankAcc = bankAccountResult.rows[0];
    const accountCode = bankAcc.account_type === 'cash' ? '1001' : '1002';

    const accountResult = await client.query(
      `SELECT id FROM accounts WHERE tenant_id = $1 AND code = $2`,
      [tenantId, accountCode]
    );

    if (accountResult.rows[0]) {
      const accountId = accountResult.rows[0].id;
      const entryResult = await client.query(
        `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [tenantId, transaction_date || new Date(), description, reference || `TXN-${Date.now()}`, userId]
      );
      const entry = entryResult.rows[0];

      if (transaction_type === 'credit') {
        await client.query(
          `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
          [entry.id, accountId, amount]
        );
        await client.query(
          `UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [amount, accountId]
        );
      } else {
        await client.query(
          `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
          [entry.id, accountId, amount]
        );
        await client.query(
          `UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [amount, accountId]
        );
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

    // Auto post to accounting
    const cashAccount = await client.query(
      `SELECT id FROM accounts WHERE tenant_id = $1 AND code = '1001'`, [tenantId]
    );

    if (cashAccount.rows[0]) {
      const entryResult = await client.query(
        `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
         VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
        [tenantId, `M-Pesa ${direction === 'in' ? 'received' : 'sent'} — ${description}`, transaction_id, req.user.userId]
      );
      const entry = entryResult.rows[0];

      if (direction === 'in') {
        await client.query(
          `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
          [entry.id, cashAccount.rows[0].id, amount]
        );
        await client.query(
          `UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [amount, cashAccount.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
          [entry.id, cashAccount.rows[0].id, amount]
        );
        await client.query(
          `UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [amount, cashAccount.rows[0].id]
        );
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
    const accounts = await pool.query(
      `SELECT
        COUNT(*) as total_accounts,
        SUM(current_balance) as total_balance,
        SUM(CASE WHEN account_type = 'mpesa' THEN current_balance ELSE 0 END) as mpesa_balance,
        SUM(CASE WHEN account_type = 'bank' THEN current_balance ELSE 0 END) as bank_balance,
        SUM(CASE WHEN account_type = 'cash' THEN current_balance ELSE 0 END) as cash_balance
       FROM bank_accounts WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    );

    const transactions = await pool.query(
      `SELECT
        COUNT(*) as total_transactions,
        SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) as total_credits,
        SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) as total_debits,
        SUM(CASE WHEN is_reconciled = false THEN 1 ELSE 0 END) as unreconciled_count
       FROM bank_transactions WHERE tenant_id = $1`,
      [tenantId]
    );

    const mpesa = await pool.query(
      `SELECT
        COUNT(*) as total_mpesa,
        SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END) as total_mpesa_in,
        SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as total_mpesa_out
       FROM mpesa_transactions WHERE tenant_id = $1`,
      [tenantId]
    );

    res.json({
      ...accounts.rows[0],
      ...transactions.rows[0],
      ...mpesa.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
