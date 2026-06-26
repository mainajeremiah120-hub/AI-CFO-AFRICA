import pool from '../../config/db.js';
import { AppError, assertPositiveAmount, handleError } from '../../middleware/validate.js';

// ─── ACCOUNTS ───────────────────────────────────────────

export const createAccount = async (req, res) => {
  const { code, name, type, description, parent_id } = req.body;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `INSERT INTO accounts (tenant_id, code, name, type, description, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenantId, code, name, type, description, parent_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAccounts = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT * FROM accounts WHERE tenant_id = $1 AND is_active = true ORDER BY code ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateAccount = async (req, res) => {
  const { id } = req.params;
  const { name, description, is_active } = req.body;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `UPDATE accounts SET name=$1, description=$2, is_active=$3
       WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [name, description, is_active, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteAccount = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `UPDATE accounts SET is_active = false WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── JOURNAL ENTRIES ────────────────────────────────────

export const createJournalEntry = async (req, res) => {
  const { date, description, reference, lines } = req.body;
  const { tenantId, userId } = req.user;

  // Validate debits === credits
  const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);

  if (totalDebit !== totalCredit) {
    return res.status(400).json({ error: `Debits (${totalDebit}) must equal credits (${totalCredit})` });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const entryResult = await client.query(
      `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, date || new Date(), description, reference, userId]
    );
    const entry = entryResult.rows[0];

    for (const line of lines) {
      // Tenant isolation: verify account belongs to this tenant
      const acctCheck = await client.query(
        `SELECT id FROM accounts WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
        [line.account_id, tenantId]
      );
      if (acctCheck.rows.length === 0) {
        throw new AppError(`Account ID ${line.account_id} not found in your chart of accounts`);
      }

      const debit  = Math.round(Number(line.debit  || 0) * 100) / 100;
      const credit = Math.round(Number(line.credit || 0) * 100) / 100;
      if (debit < 0 || credit < 0) throw new AppError('Debit and credit amounts cannot be negative');

      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4)`,
        [entry.id, line.account_id, debit, credit]
      );

      // Update account balance
      await client.query(
        `UPDATE accounts SET balance = balance + $1 - $2 WHERE id = $3`,
        [debit, credit, line.account_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(entry);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getJournalEntries = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT je.*, 
        json_agg(json_build_object(
          'id', jl.id,
          'account_id', jl.account_id,
          'account_name', a.name,
          'account_code', a.code,
          'debit', jl.debit,
          'credit', jl.credit
        )) as lines
       FROM journal_entries je
       LEFT JOIN journal_lines jl ON je.id = jl.journal_entry_id
       LEFT JOIN accounts a ON jl.account_id = a.id
       WHERE je.tenant_id = $1
       GROUP BY je.id
       ORDER BY je.date DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── TRIAL BALANCE ──────────────────────────────────────

export const getTrialBalance = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT code, name, type, balance
       FROM accounts
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY code ASC`,
      [tenantId]
    );

    const totalDebit = result.rows
      .filter(a => a.balance > 0)
      .reduce((sum, a) => sum + Number(a.balance), 0);

    const totalCredit = result.rows
      .filter(a => a.balance < 0)
      .reduce((sum, a) => sum + Number(a.balance), 0);

    res.json({
      accounts: result.rows,
      totalDebit,
      totalCredit: Math.abs(totalCredit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── FISCAL YEARS ───────────────────────────────────────

export const createFiscalYear = async (req, res) => {
  const { name, start_date, end_date } = req.body;
  const { tenantId } = req.user;

  try {
    await pool.query(
      `UPDATE fiscal_years SET is_active = false WHERE tenant_id = $1`,
      [tenantId]
    );

    const result = await pool.query(
      `INSERT INTO fiscal_years (tenant_id, name, start_date, end_date, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [tenantId, name, start_date, end_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getFiscalYears = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT * FROM fiscal_years WHERE tenant_id = $1 ORDER BY start_date DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// ─── JOURNAL ENTRY EDIT / DELETE ────────────────────────
export const updateJournalEntry = async (req, res) => {
  const { id } = req.params;
  const { description, reference } = req.body;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `UPDATE journal_entries SET
         description = COALESCE($1, description),
         reference   = COALESCE($2, reference)
       WHERE id=$3 AND tenant_id=$4 RETURNING *`,
      [description || null, reference || null, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Journal entry not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteJournalEntry = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const entry = (await client.query(`SELECT id FROM journal_entries WHERE id=$1 AND tenant_id=$2`, [id, tenantId])).rows[0];
    if (!entry) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Journal entry not found' }); }

    const lines = (await client.query(`SELECT * FROM journal_lines WHERE journal_entry_id=$1`, [id])).rows;
    for (const l of lines) {
      await client.query(`UPDATE accounts SET balance = balance - $1 + $2 WHERE id=$3`, [l.debit, l.credit, l.account_id]);
    }
    await client.query(`DELETE FROM journal_lines WHERE journal_entry_id=$1`, [id]);
    await client.query(`DELETE FROM journal_entries WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    await client.query('COMMIT');
    res.json({ message: 'Journal entry deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
