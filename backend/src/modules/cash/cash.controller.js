import pool from '../../config/db.js';
import { assertPositiveAmount, assertStringLength, AppError, handleError } from '../../middleware/validate.js';

// ─── SUMMARY ─────────────────────────────────────────────

export const getCashSummary = async (req, res) => {
  const { tenantId } = req.user;
  try {
    // All cash-type bank accounts
    const accounts = await pool.query(`
      SELECT ba.*,
        COALESCE(SUM(CASE WHEN bt.transaction_type='credit' THEN bt.amount ELSE -bt.amount END), 0) AS transaction_total
      FROM bank_accounts ba
      LEFT JOIN bank_transactions bt ON ba.id = bt.bank_account_id
      WHERE ba.tenant_id=$1 AND ba.account_type='cash' AND ba.is_active=true
      GROUP BY ba.id
      ORDER BY ba.account_name
    `, [tenantId]);

    const totalCash = accounts.rows.reduce((s, a) => s + Number(a.current_balance), 0);

    // Today's cash movements
    const today = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN bt.transaction_type='credit' THEN bt.amount ELSE 0 END), 0) AS today_in,
        COALESCE(SUM(CASE WHEN bt.transaction_type='debit'  THEN bt.amount ELSE 0 END), 0) AS today_out
      FROM bank_transactions bt
      JOIN bank_accounts ba ON bt.bank_account_id = ba.id
      WHERE bt.tenant_id=$1 AND ba.account_type='cash'
        AND DATE(bt.transaction_date) = CURRENT_DATE
    `, [tenantId]);

    // This month's cash flow
    const monthly = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN bt.transaction_type='credit' THEN bt.amount ELSE 0 END), 0) AS month_in,
        COALESCE(SUM(CASE WHEN bt.transaction_type='debit'  THEN bt.amount ELSE 0 END), 0) AS month_out,
        COUNT(*) AS total_transactions
      FROM bank_transactions bt
      JOIN bank_accounts ba ON bt.bank_account_id = ba.id
      WHERE bt.tenant_id=$1 AND ba.account_type='cash'
        AND DATE_TRUNC('month', bt.transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
    `, [tenantId]);

    // Authoritative GL balance for account 1001 (from journal_lines)
    const glBalance = await pool.query(`
      SELECT COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS balance
      FROM journal_lines jl
      JOIN accounts a ON jl.account_id = a.id
      WHERE a.tenant_id=$1 AND a.code='1001'
    `, [tenantId]);

    res.json({
      accounts: accounts.rows,
      total_cash: totalCash,
      gl_cash_balance: Number(glBalance.rows[0]?.balance || 0),
      ...today.rows[0],
      ...monthly.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── CASH ACCOUNTS ───────────────────────────────────────

export const getCashAccounts = async (req, res) => {
  const { tenantId } = req.user;
  try {
    const result = await pool.query(`
      SELECT ba.*,
        COALESCE(SUM(CASE WHEN bt.transaction_type='credit' THEN bt.amount ELSE -bt.amount END), 0) AS transaction_total
      FROM bank_accounts ba
      LEFT JOIN bank_transactions bt ON ba.id = bt.bank_account_id
      WHERE ba.tenant_id=$1 AND ba.account_type='cash' AND ba.is_active=true
      GROUP BY ba.id
      ORDER BY ba.account_name
    `, [tenantId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── CASH TRANSACTIONS ───────────────────────────────────

export const getCashTransactions = async (req, res) => {
  const { tenantId } = req.user;
  const { account_id, from, to } = req.query;

  try {
    const params = [tenantId];
    let filters = '';
    if (account_id) { params.push(account_id); filters += ` AND bt.bank_account_id = $${params.length}`; }
    if (from)       { params.push(from);       filters += ` AND DATE(bt.transaction_date) >= $${params.length}`; }
    if (to)         { params.push(to);         filters += ` AND DATE(bt.transaction_date) <= $${params.length}`; }

    const result = await pool.query(`
      SELECT bt.*, ba.account_name, ba.account_type
      FROM bank_transactions bt
      JOIN bank_accounts ba ON bt.bank_account_id = ba.id
      WHERE bt.tenant_id=$1 AND ba.account_type='cash'
        ${filters}
      ORDER BY bt.transaction_date DESC, bt.created_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── CASH LEDGER (all journal entries touching account 1001) ──

export const getCashLedger = async (req, res) => {
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
        jl.debit,
        jl.credit,
        CASE
          WHEN je.description ILIKE '%payment for bill%'  OR je.description ILIKE '%bill payment%'    THEN 'Payables'
          WHEN je.description ILIKE '%payment for invoice%' OR je.description ILIKE '%invoice payment%' THEN 'Receivables'
          WHEN je.description ILIKE '%opening balance%'                                                THEN 'Opening Balance'
          WHEN je.description ILIKE '%balance adjustment%'                                             THEN 'Adjustment'
          WHEN je.description ILIKE '%cash receipt%'                                                   THEN 'Cash Receipt'
          WHEN je.description ILIKE '%cash payment%'                                                   THEN 'Cash Payment'
          WHEN je.description ILIKE '%petty cash%'                                                     THEN 'Petty Cash'
          WHEN je.description ILIKE '%pos sale%'          OR je.description ILIKE '%point of sale%'   THEN 'POS'
          WHEN je.description ILIKE '%payroll%'           OR je.description ILIKE '%salary%'          THEN 'Payroll'
          ELSE 'General'
        END AS source_module
      FROM journal_entries je
      JOIN journal_lines jl ON je.id = jl.journal_entry_id
      JOIN accounts      a  ON jl.account_id = a.id
      WHERE je.tenant_id=$1
        AND a.code = '1001'
        ${dateFilter}
      ORDER BY je.date DESC, je.created_at DESC
      LIMIT 1000
    `, params);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── RECORD CASH RECEIPT ─────────────────────────────────
// Debit 1001 (Cash), Credit Revenue (4002) or Receivables (1003)

export const recordCashReceipt = async (req, res) => {
  const { cash_account_id, amount, date, description, reference, receipt_type } = req.body;
  // receipt_type: 'cash_sale' | 'customer_payment'
  const { tenantId, userId } = req.user;
  const client = await pool.connect();

  try {
    assertPositiveAmount(amount, 'Amount');
    assertStringLength(description, 'Description', 500);
    assertStringLength(reference, 'Reference', 100);

    await client.query('BEGIN');

    const accCheck = await client.query(
      `SELECT * FROM bank_accounts WHERE id=$1 AND tenant_id=$2 AND account_type='cash' AND is_active=true`,
      [cash_account_id, tenantId]
    );
    if (!accCheck.rows[0]) throw new AppError('Cash account not found', 404);

    const amt = Math.round(Number(amount) * 100) / 100;

    // Update cash account balance
    await client.query(
      `UPDATE bank_accounts SET current_balance = current_balance + $1 WHERE id=$2`, [amt, cash_account_id]
    );

    const ref = reference || `CASH-IN-${Date.now()}`;

    // Record bank transaction
    await client.query(`
      INSERT INTO bank_transactions (tenant_id, bank_account_id, transaction_date, description, amount, transaction_type, reference)
      VALUES ($1, $2, $3, $4, $5, 'credit', $6)
    `, [tenantId, cash_account_id, date || new Date(), description, amt, ref]);

    // Journal: Dr 1001 (Cash at Hand), Cr 4002 (Revenue) or 1003 (Receivables)
    const cashAcct = await client.query(
      `SELECT id FROM accounts WHERE tenant_id=$1 AND code='1001'`, [tenantId]
    );
    const crCode  = receipt_type === 'customer_payment' ? '1003' : '4002';
    const crAcct  = await client.query(
      `SELECT id FROM accounts WHERE tenant_id=$1 AND code=$2`, [tenantId, crCode]
    );

    if (cashAcct.rows[0]) {
      const entry = (await client.query(`
        INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, [tenantId, date || new Date(), `Cash receipt — ${description}`, ref, userId])).rows[0];

      // Dr Cash (1001)
      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,0)`,
        [entry.id, cashAcct.rows[0].id, amt]
      );
      await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id=$2`, [amt, cashAcct.rows[0].id]);

      // Cr Revenue / Receivables
      if (crAcct.rows[0]) {
        await client.query(
          `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,0,$3)`,
          [entry.id, crAcct.rows[0].id, amt]
        );
        await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id=$2`, [amt, crAcct.rows[0].id]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Cash receipt recorded' });
  } catch (err) {
    await client.query('ROLLBACK');
    return handleError(res, err);
  } finally {
    client.release();
  }
};

// ─── RECORD CASH PAYMENT ─────────────────────────────────
// Debit Expenses (5001) or Payables (1004), Credit 1001 (Cash)

export const recordCashPayment = async (req, res) => {
  const { cash_account_id, amount, date, description, reference, payment_type } = req.body;
  // payment_type: 'expense' | 'supplier_payment' | 'petty_cash_expense'
  const { tenantId, userId } = req.user;
  const client = await pool.connect();

  try {
    assertPositiveAmount(amount, 'Amount');
    assertStringLength(description, 'Description', 500);
    assertStringLength(reference, 'Reference', 100);

    await client.query('BEGIN');

    const accCheck = await client.query(
      `SELECT * FROM bank_accounts WHERE id=$1 AND tenant_id=$2 AND account_type='cash' AND is_active=true`,
      [cash_account_id, tenantId]
    );
    if (!accCheck.rows[0]) throw new AppError('Cash account not found', 404);

    const amt = Math.round(Number(amount) * 100) / 100;

    if (Number(accCheck.rows[0].current_balance) - amt < -0.01) {
      throw new AppError(
        `Insufficient cash. Available: KES ${Number(accCheck.rows[0].current_balance).toLocaleString()}`
      );
    }

    await client.query(
      `UPDATE bank_accounts SET current_balance = current_balance - $1 WHERE id=$2`, [amt, cash_account_id]
    );

    const ref = reference || `CASH-OUT-${Date.now()}`;

    await client.query(`
      INSERT INTO bank_transactions (tenant_id, bank_account_id, transaction_date, description, amount, transaction_type, reference)
      VALUES ($1, $2, $3, $4, $5, 'debit', $6)
    `, [tenantId, cash_account_id, date || new Date(), description, amt, ref]);

    // Journal: Dr 5001 (Expenses) or 1004 (Payables), Cr 1001 (Cash)
    const cashAcct = await client.query(
      `SELECT id FROM accounts WHERE tenant_id=$1 AND code='1001'`, [tenantId]
    );
    const drCode  = payment_type === 'supplier_payment' ? '1004' : '5001';
    const drAcct  = await client.query(
      `SELECT id FROM accounts WHERE tenant_id=$1 AND code=$2`, [tenantId, drCode]
    );

    if (cashAcct.rows[0]) {
      const entry = (await client.query(`
        INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, [tenantId, date || new Date(), `Cash payment — ${description}`, ref, userId])).rows[0];

      // Dr Expenses / Payables
      if (drAcct.rows[0]) {
        await client.query(
          `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,0)`,
          [entry.id, drAcct.rows[0].id, amt]
        );
        await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id=$2`, [amt, drAcct.rows[0].id]);
      }

      // Cr Cash (1001)
      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,0,$3)`,
        [entry.id, cashAcct.rows[0].id, amt]
      );
      await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id=$2`, [amt, cashAcct.rows[0].id]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Cash payment recorded' });
  } catch (err) {
    await client.query('ROLLBACK');
    return handleError(res, err);
  } finally {
    client.release();
  }
};

// ─── PETTY CASH REPLENISHMENT ─────────────────────────────
// Transfer from a bank account into a petty cash fund.
// Journal: Dr 1001 (Cash/Petty Cash), Cr 1002 (Bank)

export const replenishPettyCash = async (req, res) => {
  const { petty_cash_account_id, bank_account_id, amount, date, reference } = req.body;
  const { tenantId, userId } = req.user;
  const client = await pool.connect();

  try {
    assertPositiveAmount(amount, 'Amount');

    await client.query('BEGIN');

    const pcAcc = await client.query(
      `SELECT * FROM bank_accounts WHERE id=$1 AND tenant_id=$2 AND account_type='cash' AND is_active=true`,
      [petty_cash_account_id, tenantId]
    );
    if (!pcAcc.rows[0]) throw new AppError('Petty cash account not found', 404);

    const bankAcc = await client.query(
      `SELECT * FROM bank_accounts WHERE id=$1 AND tenant_id=$2 AND account_type IN ('bank','mpesa') AND is_active=true`,
      [bank_account_id, tenantId]
    );
    if (!bankAcc.rows[0]) throw new AppError('Bank account not found', 404);

    const amt = Math.round(Number(amount) * 100) / 100;

    if (Number(bankAcc.rows[0].current_balance) - amt < -0.01) {
      throw new AppError(
        `Insufficient bank balance. Available: KES ${Number(bankAcc.rows[0].current_balance).toLocaleString()}`
      );
    }

    const desc = `Petty cash replenishment — ${pcAcc.rows[0].account_name}`;
    const ref  = reference || `PC-REPLEN-${Date.now()}`;

    // Update both account balances
    await client.query(`UPDATE bank_accounts SET current_balance = current_balance + $1 WHERE id=$2`, [amt, petty_cash_account_id]);
    await client.query(`UPDATE bank_accounts SET current_balance = current_balance - $1 WHERE id=$2`, [amt, bank_account_id]);

    // Bank transactions for both sides
    await client.query(`
      INSERT INTO bank_transactions (tenant_id, bank_account_id, transaction_date, description, amount, transaction_type, reference)
      VALUES ($1,$2,$3,$4,$5,'credit',$6)
    `, [tenantId, petty_cash_account_id, date || new Date(), desc, amt, ref]);

    await client.query(`
      INSERT INTO bank_transactions (tenant_id, bank_account_id, transaction_date, description, amount, transaction_type, reference)
      VALUES ($1,$2,$3,$4,$5,'debit',$6)
    `, [tenantId, bank_account_id, date || new Date(), desc, amt, ref]);

    // Journal: Dr 1001 (Cash), Cr 1002 (Bank)
    const cashGL = await client.query(`SELECT id FROM accounts WHERE tenant_id=$1 AND code='1001'`, [tenantId]);
    const bankGL = await client.query(`SELECT id FROM accounts WHERE tenant_id=$1 AND code='1002'`, [tenantId]);

    if (cashGL.rows[0] && bankGL.rows[0]) {
      const entry = (await client.query(`
        INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
        VALUES ($1,$2,$3,$4,$5) RETURNING id
      `, [tenantId, date || new Date(), desc, ref, userId])).rows[0];

      // Dr Cash (1001)
      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,0)`,
        [entry.id, cashGL.rows[0].id, amt]
      );
      await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id=$2`, [amt, cashGL.rows[0].id]);

      // Cr Bank (1002)
      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,0,$3)`,
        [entry.id, bankGL.rows[0].id, amt]
      );
      await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id=$2`, [amt, bankGL.rows[0].id]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Petty cash replenished successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    return handleError(res, err);
  } finally {
    client.release();
  }
};
