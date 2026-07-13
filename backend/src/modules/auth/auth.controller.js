import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import pool from '../../config/db.js';
import { sendWelcomeEmail } from '../../config/mailer.js';
import { assertPasswordStrength, AppError, handleError } from '../../middleware/validate.js';

// ── DB migration — add TOTP columns if they don't exist ──────────────────────
(async () => {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(200)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false`);
    console.log('[2FA] TOTP columns ready');
  } catch (err) {
    console.error('[2FA] Migration error:', err.message);
  }
})();

const DEFAULT_ACCOUNTS = [
  { code: '1000', name: 'Owner injection Capital',  type: 'equity' },
  { code: '1001', name: 'Cash at Hand',              type: 'asset' },
  { code: '1002', name: 'Bank Account',              type: 'asset' },
  { code: '1003', name: 'Receivable Account',        type: 'asset' },
  { code: '1004', name: 'Payable-Account',           type: 'liability' },
  { code: '1005', name: 'Inventory',                 type: 'asset' },
  { code: '4001', name: 'Sales Revenue',             type: 'revenue' },
  { code: '4002', name: 'Service Revenue',           type: 'revenue' },
  { code: '5001', name: 'General Expenses',          type: 'expense' },
  { code: '5002', name: 'Salary Expense',            type: 'expense' },
  { code: '5003', name: 'Cost of Goods Sold',        type: 'expense' },
];

export const seedAccounts = async (tenantId, client) => {
  const db = client || pool;
  for (const acc of DEFAULT_ACCOUNTS) {
    await db.query(
      `INSERT INTO accounts (tenant_id, code, name, type, balance, is_active)
       VALUES ($1, $2, $3, $4, 0, true)
       ON CONFLICT (tenant_id, code) DO NOTHING`,
      [tenantId, acc.code, acc.name, acc.type]
    );
  }
};

export const register = async (req, res) => {
  const { companyName, industry, name, email, password } = req.body;

  try {
    assertPasswordStrength(password);
    if (!email || !name || !companyName) {
      return res.status(400).json({ error: 'Company name, your name, and email are required' });
    }

    const companyResult = await pool.query(
      `INSERT INTO companies (name, industry) VALUES ($1, $2) RETURNING *`,
      [companyName, industry]
    );
    const company = companyResult.rows[0];

    const password_hash = await bcrypt.hash(password, 10);

    const userResult = await pool.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [company.id, name, email, password_hash, 'admin']
    );
    const user = userResult.rows[0];

    // Seed default chart of accounts for every new tenant
    await seedAccounts(company.id);

    const token = jwt.sign(
      { userId: user.id, tenantId: company.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Fire-and-forget — don't let email failure break registration
    sendWelcomeEmail({
      name: user.name,
      email: user.email,
      companyName: company.name,
      role: user.role,
    }).catch(err => console.error('Welcome email failed:', err.message));

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, totp_enabled: false },
      company,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];

    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    // Check if 2FA is enabled — issue partial token and prompt for OTP
    if (user.totp_enabled) {
      const partialToken = jwt.sign(
        { userId: user.id, tenantId: user.tenant_id, requires_2fa: true },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({ requires_2fa: true, partial_token: partialToken });
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const companyResult = await pool.query(
      `SELECT * FROM companies WHERE id = $1`, [user.tenant_id]
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, totp_enabled: user.totp_enabled ?? false },
      company: companyResult.rows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── 2FA: Generate secret + QR code ───────────────────────────────────────────
export const setup2FA = async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: 'AI CFO Africa (' + req.user.email + ')',
      length: 20,
    });

    // Store secret (not yet enabled) so verify step can read it
    await pool.query(
      `UPDATE users SET totp_secret = $1 WHERE id = $2`,
      [secret.base32, req.user.userId]
    );

    const dataUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({ qr_code: dataUrl, secret: secret.base32 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── 2FA: Verify code from authenticator and enable 2FA ───────────────────────
export const verify2FASetup = async (req, res) => {
  const { token } = req.body;
  try {
    const result = await pool.query(
      `SELECT totp_secret FROM users WHERE id = $1`,
      [req.user.userId]
    );
    const user = result.rows[0];
    if (!user || !user.totp_secret) {
      return res.status(400).json({ error: '2FA setup not initiated — call /2fa/setup first' });
    }

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) {
      return res.status(400).json({ error: 'Invalid code — please try again' });
    }

    await pool.query(
      `UPDATE users SET totp_enabled = true WHERE id = $1`,
      [req.user.userId]
    );

    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── 2FA: Disable (requires valid TOTP) ───────────────────────────────────────
export const disable2FA = async (req, res) => {
  const { token } = req.body;
  try {
    const result = await pool.query(
      `SELECT totp_secret FROM users WHERE id = $1`,
      [req.user.userId]
    );
    const user = result.rows[0];
    if (!user || !user.totp_secret) {
      return res.status(400).json({ error: '2FA is not enabled on this account' });
    }

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) {
      return res.status(400).json({ error: 'Invalid code — please try again' });
    }

    await pool.query(
      `UPDATE users SET totp_enabled = false, totp_secret = null WHERE id = $1`,
      [req.user.userId]
    );

    res.json({ success: true, message: '2FA disabled successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── 2FA: Validate OTP during login (no protect — uses partial token) ──────────
export const validate2FA = async (req, res) => {
  const { partial_token, token } = req.body;
  try {
    let decoded;
    try {
      decoded = jwt.verify(partial_token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired session — please log in again' });
    }

    if (!decoded.requires_2fa) {
      return res.status(401).json({ error: 'Invalid partial token' });
    }

    const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [decoded.userId]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User not found' });

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) {
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    const fullToken = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const companyResult = await pool.query(
      `SELECT * FROM companies WHERE id = $1`, [user.tenant_id]
    );

    res.json({
      token: fullToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, totp_enabled: user.totp_enabled ?? true },
      company: companyResult.rows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
