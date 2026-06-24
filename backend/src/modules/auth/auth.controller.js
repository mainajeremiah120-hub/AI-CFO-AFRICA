import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../../config/db.js';
import { sendWelcomeEmail } from '../../config/mailer.js';

export const register = async (req, res) => {
  const { companyName, industry, name, email, password } = req.body;

  try {
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

    const token = jwt.sign(
      { userId: user.id, tenantId: company.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Fire-and-forget — don't let email failure break registration
    sendWelcomeEmail({
      name: user.name,
      email: user.email,
      password,
      companyName: company.name,
      role: user.role,
    }).catch(err => console.error('Welcome email failed:', err.message));

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      company,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

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
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      company: companyResult.rows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};