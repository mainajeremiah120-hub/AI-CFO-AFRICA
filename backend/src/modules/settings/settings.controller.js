import pool from '../../config/db.js';
import bcrypt from 'bcryptjs';
import { sendWelcomeEmail, sendUserUpdateEmail } from '../../config/mailer.js';
import { seedAccounts } from '../auth/auth.controller.js';

// ─── COMPANY SETTINGS ────────────────────────────────────

export const getSettings = async (req, res) => {
  const { tenantId } = req.user;

  try {
    // Get company info
    const company = await pool.query(
      `SELECT * FROM companies WHERE id = $1`, [tenantId]
    );

    // Get settings
    let settings = await pool.query(
      `SELECT * FROM company_settings WHERE tenant_id = $1`, [tenantId]
    );

    // Auto create settings if not exists
    if (settings.rows.length === 0) {
      settings = await pool.query(
        `INSERT INTO company_settings (tenant_id) VALUES ($1) RETURNING *`,
        [tenantId]
      );
    }

    res.json({
      company: company.rows[0],
      settings: settings.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateCompany = async (req, res) => {
  const { name, industry, country, currency } = req.body;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `UPDATE companies SET name=$1, industry=$2, country=$3, currency=$4 WHERE id=$5 RETURNING *`,
      [name, industry, country, currency, tenantId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateSettings = async (req, res) => {
  const {
    address, kra_pin, phone, email, website,
    default_tax_rate, default_payment_terms,
    fiscal_year_start, date_format,
    receipt_header, receipt_footer, etr_device_number,
    low_stock_alerts, email_notifications,
    overdue_alerts, payroll_reminders
  } = req.body;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `UPDATE company_settings SET
        address=$1, kra_pin=$2, phone=$3, email=$4, website=$5,
        default_tax_rate=$6, default_payment_terms=$7,
        fiscal_year_start=$8, date_format=$9,
        receipt_header=$10, receipt_footer=$11, etr_device_number=$12,
        low_stock_alerts=$13, email_notifications=$14,
        overdue_alerts=$15, payroll_reminders=$16,
        updated_at=NOW()
       WHERE tenant_id=$17 RETURNING *`,
      [
        address, kra_pin, phone, email, website,
        default_tax_rate, default_payment_terms,
        fiscal_year_start, date_format,
        receipt_header, receipt_footer, etr_device_number,
        low_stock_alerts, email_notifications,
        overdue_alerts, payroll_reminders,
        tenantId
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── USER PROFILE ────────────────────────────────────────

export const getProfile = async (req, res) => {
  const { userId } = req.user;

  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1`,
      [userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProfile = async (req, res) => {
  const { name, email } = req.body;
  const { userId } = req.user;

  try {
    const result = await pool.query(
      `UPDATE users SET name=$1, email=$2 WHERE id=$3 RETURNING id, name, email, role`,
      [name, email, userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  const { userId } = req.user;

  try {
    const userResult = await pool.query(
      `SELECT * FROM users WHERE id = $1`, [userId]
    );
    const user = userResult.rows[0];

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await pool.query(
      `UPDATE users SET password_hash=$1 WHERE id=$2`, [password_hash, userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── MANAGE USERS ────────────────────────────────────────

export const getUsers = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_active, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createUser = async (req, res) => {
  const { name, email, password, role } = req.body;
  const { tenantId } = req.user;

  try {
    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role`,
      [tenantId, name, email, password_hash, role || 'accountant']
    );

    const companyResult = await pool.query(
      `SELECT name FROM companies WHERE id = $1`, [tenantId]
    );
    const companyName = companyResult.rows[0]?.name || 'Your Organization';

    sendWelcomeEmail({ name, email, password, companyName, role: role || 'accountant' })
      .catch(err => console.error('Welcome email failed:', err.message));

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role, is_active, name, email } = req.body;
  const { tenantId, userId } = req.user;

  if (String(id) === String(userId) && is_active === false) {
    return res.status(400).json({ error: 'You cannot deactivate your own account' });
  }

  try {
    // Fetch current user to detect changes
    const before = await pool.query(
      `SELECT * FROM users WHERE id=$1 AND tenant_id=$2`, [id, tenantId]
    );
    if (before.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const prev = before.rows[0];

    const result = await pool.query(
      `UPDATE users SET role=$1, is_active=$2, name=COALESCE($3, name), email=COALESCE($4, email)
       WHERE id=$5 AND tenant_id=$6 RETURNING id, name, email, role, is_active`,
      [role, is_active, name || null, email || null, id, tenantId]
    );
    const updated = result.rows[0];

    // Build list of changes and send email
    const changes = [];
    if (name && name !== prev.name) changes.push({ label: 'Name', value: name });
    if (email && email !== prev.email) changes.push({ label: 'Email', value: email });
    if (role !== prev.role) changes.push({ label: 'Role', value: role.replace('_', ' ').toUpperCase() });
    if (is_active !== prev.is_active) changes.push({ label: 'Account Status', value: is_active ? 'Active' : 'Inactive' });

    if (changes.length > 0) {
      const companyResult = await pool.query(`SELECT name FROM companies WHERE id=$1`, [tenantId]);
      const companyName = companyResult.rows[0]?.name || 'Your Organization';
      sendUserUpdateEmail({
        name: updated.name,
        email: updated.email,
        changes,
        companyName,
      }).catch(err => console.error('Update email failed:', err.message));
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;
  const { tenantId, userId } = req.user;

  if (String(id) === String(userId)) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    // Verify the user belongs to this tenant first
    const check = await pool.query(
      `SELECT id, tenant_id FROM users WHERE id=$1`, [id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (String(check.rows[0].tenant_id) !== String(tenantId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query(`DELETE FROM users WHERE id=$1`, [id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── DATA RESET ──────────────────────────────────────────

export const resetTransactionData = async (req, res) => {
  const { confirm_text } = req.body;
  const { tenantId } = req.user;

  if (confirm_text !== 'RESET') {
    return res.status(400).json({ error: 'Please type RESET to confirm' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Clear all transaction data but keep accounts, companies, users, settings
    await client.query(`DELETE FROM pos_sale_items WHERE sale_id IN (SELECT id FROM pos_sales WHERE tenant_id = $1)`, [tenantId]);
    await client.query(`DELETE FROM pos_sales WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM pos_sessions WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM mpesa_transactions WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM bank_transactions WHERE bank_account_id IN (SELECT id FROM bank_accounts WHERE tenant_id = $1)`, [tenantId]);
    await client.query(`DELETE FROM bank_accounts WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE tenant_id = $1)`, [tenantId]);
    await client.query(`DELETE FROM journal_entries WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM payslips WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM payroll_runs WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM goods_received WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM po_items WHERE po_id IN (SELECT id FROM purchase_orders WHERE tenant_id = $1)`, [tenantId]);
    await client.query(`DELETE FROM purchase_orders WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM requisitions WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM stock_movements WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM stock_levels WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM bill_payments WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM bill_items WHERE bill_id IN (SELECT id FROM bills WHERE tenant_id = $1)`, [tenantId]);
    await client.query(`DELETE FROM bills WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM payments WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE tenant_id = $1)`, [tenantId]);
    await client.query(`DELETE FROM invoices WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM fiscal_years WHERE tenant_id = $1`, [tenantId]);

    // Reset account balances to 0 but keep the accounts
    await client.query(`UPDATE accounts SET balance = 0 WHERE tenant_id = $1`, [tenantId]);

    await client.query('COMMIT');

    // Re-seed default accounts in case any were deleted
    await seedAccounts(tenantId);

    res.json({ message: 'Transaction data cleared successfully. Accounts and settings preserved.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};