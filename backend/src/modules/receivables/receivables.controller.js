import pool from '../../config/db.js';
import { assertPositiveAmount, assertStringLength, AppError, handleError } from '../../middleware/validate.js';
import { logAudit } from '../audit/audit.controller.js';

// ─── STARTUP MIGRATIONS ──────────────────────────────────
(async () => {
  try {
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS vat_number VARCHAR(50)`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(15,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(15,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS portal_token VARCHAR(64) UNIQUE`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portal_payment_intents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        payment_method VARCHAR(30),
        mpesa_number VARCHAR(20),
        amount NUMERIC(15,2),
        reference VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recurring_invoice_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        customer_id UUID NOT NULL,
        frequency VARCHAR(20) NOT NULL,
        next_invoice_date DATE NOT NULL,
        last_invoice_date DATE,
        invoice_number_prefix VARCHAR(50),
        items JSONB NOT NULL,
        tax_rate NUMERIC(5,2) DEFAULT 0,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_by UUID,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('[Receivables] Startup migrations done');
  } catch (e) {
    console.error('[Receivables] Migration error:', e.message);
  }
})();

// ─── CUSTOMERS ───────────────────────────────────────────
export const createCustomer = async (req, res) => {
  const { name, email, phone, address, customer_type, vat_number } = req.body;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `INSERT INTO customers (tenant_id, name, email, phone, address, customer_type, vat_number) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, name, email, phone, address, customer_type || 'individual', vat_number || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getCustomers = async (req, res) => {
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `SELECT * FROM customers WHERE tenant_id = $1 AND is_active = true ORDER BY name ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, address, customer_type, vat_number } = req.body;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `UPDATE customers SET name=$1, email=$2, phone=$3, address=$4, customer_type=$5, vat_number=$6
       WHERE id=$7 AND tenant_id=$8 RETURNING *`,
      [name, email, phone, address, customer_type, vat_number || null, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  try {
    await pool.query(
      `UPDATE customers SET is_active=false WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── INVOICES ────────────────────────────────────────────
export const createInvoice = async (req, res) => {
  const { customer_id, invoice_number, date, due_date, items, tax_rate, notes } = req.body;
  const { tenantId, userId } = req.user;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Calculate totals with per-item VAT
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const tax_amount = (subtotal * (tax_rate || 0)) / 100;
    // Per-item VAT: each item can have vat_rate (default 16)
    const total_vat_amount = items.reduce((sum, item) => {
      const rate = item.vat_rate !== undefined ? Number(item.vat_rate) : 16;
      return sum + (item.quantity * item.unit_price * rate / 100);
    }, 0);
    const total_amount = subtotal + tax_amount;

    // 2. Insert invoice with vat_amount
    const invoiceResult = await client.query(
      `INSERT INTO invoices (tenant_id, customer_id, invoice_number, date, due_date, subtotal, tax_amount, total_amount, balance_due, notes, created_by, vat_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [tenantId, customer_id, invoice_number, date, due_date, subtotal, tax_amount, total_amount, total_amount, notes, userId, total_vat_amount]
    );
    const invoiceId = invoiceResult.rows[0].id;

    // 3. Insert items with per-item vat_rate and vat_amount
    for (const item of items) {
      const itemVatRate = item.vat_rate !== undefined ? Number(item.vat_rate) : 16;
      const itemVatAmount = item.quantity * item.unit_price * itemVatRate / 100;
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total, vat_rate, vat_amount) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [invoiceId, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price, itemVatRate, itemVatAmount]
      );
    }

    // 4. Create Journal Entry
    const entryRes = await client.query(
      `INSERT INTO journal_entries (tenant_id, date, description, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, date, `Invoice #${invoice_number}`, userId]
    );

    // Fetch account UUIDs by code
    const arAccountRes = await client.query(`SELECT id FROM accounts WHERE code = '1003' AND tenant_id = $1`, [tenantId]);
    const salesAccountRes = await client.query(`SELECT id FROM accounts WHERE code = '4002' AND tenant_id = $1`, [tenantId]);

    if (arAccountRes.rows.length === 0 || salesAccountRes.rows.length === 0) {
      throw new Error("Required accounting codes (1003 or 4002) are missing from Chart of Accounts.");
    }
    const arAccountId = arAccountRes.rows[0].id;
    const salesAccountId = salesAccountRes.rows[0].id;

    // 5. Journal Lines
    await client.query(
      `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0), ($1, $4, 0, $3)`, 
      [entryRes.rows[0].id, arAccountId, total_amount, salesAccountId]
    );

    // 6. Update Accounts
    await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2 AND tenant_id = $3`, [total_amount, arAccountId, tenantId]);
    await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND tenant_id = $3`, [total_amount, salesAccountId, tenantId]);

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'invoice', invoiceId, `Created invoice ${invoice_number} for customer ${customer_id}`);
    res.status(201).json({ id: invoiceId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Invoice Creation Error:", err); // Log the real error for debugging
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getInvoices = async (req, res) => {
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `SELECT i.*, c.name as customer_name
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.tenant_id = $1
       ORDER BY i.created_at DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getInvoice = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `SELECT i.*, c.name as customer_name, json_agg(json_build_object('id', ii.id, 'description', ii.description, 'quantity', ii.quantity, 'unit_price', ii.unit_price, 'total', ii.total)) as items
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
       WHERE i.id = $1 AND i.tenant_id = $2 GROUP BY i.id, c.name`,
      [id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── PAYMENTS ────────────────────────────────────────────
export const recordPayment = async (req, res) => {
  const { invoice_id, amount, payment_date, payment_method, reference, notes, bank_account_id } = req.body;
  const { tenantId, userId } = req.user;
  const client = await pool.connect();
  try {
    assertPositiveAmount(amount, 'Payment amount');
    assertStringLength(reference, 'Reference', 100);
    assertStringLength(notes, 'Notes', 500);

    await client.query('BEGIN');
    const invoice = (await client.query(`SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2`, [invoice_id, tenantId])).rows[0];
    if (!invoice) throw new AppError('Invoice not found', 404);

    const payAmt = Math.round(Number(amount) * 100) / 100;
    if (payAmt > Number(invoice.balance_due) + 0.01) {
      throw new AppError(`Payment (${payAmt}) exceeds invoice balance due (${invoice.balance_due})`);
    }

    await client.query(`INSERT INTO payments (tenant_id, invoice_id, customer_id, amount, payment_date, payment_method, reference, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [tenantId, invoice_id, invoice.customer_id, amount, payment_date, payment_method, reference, notes]);

    const new_paid = Number(invoice.amount_paid || 0) + Number(amount);
    await client.query(`UPDATE invoices SET amount_paid = $1, balance_due = $2, status = $3 WHERE id = $4`,
      [new_paid, Number(invoice.total_amount) - new_paid, new_paid >= invoice.total_amount ? 'paid' : 'partial', invoice_id]);

    const arAccountRes = await client.query(
      `SELECT id FROM accounts WHERE code = '1003' AND tenant_id = $1`, [tenantId]
    );
    if (arAccountRes.rows.length === 0) {
      throw new Error("Account 1003 (Accounts Receivable) is missing from Chart of Accounts.");
    }
    const arAccountId = arAccountRes.rows[0].id;

    // ─── Resolve which bank account and its specific GL account ──────────────
    let effectiveBankId = bank_account_id || null;
    if (!effectiveBankId) {
      const targetType = payment_method === 'cash' ? 'cash' : 'bank';
      const primaryAcc = await client.query(
        `SELECT id FROM bank_accounts WHERE tenant_id=$1 AND account_type=$2 AND is_active=true ORDER BY created_at ASC LIMIT 1`,
        [tenantId, targetType]
      );
      effectiveBankId = primaryAcc.rows[0]?.id || null;
    }

    let cashAccountId = null;
    if (effectiveBankId) {
      const bankRec = (await client.query(
        `SELECT gl_account_id, account_type FROM bank_accounts WHERE id=$1 AND tenant_id=$2`,
        [effectiveBankId, tenantId]
      )).rows[0];
      if (bankRec?.gl_account_id) {
        cashAccountId = bankRec.gl_account_id;
      } else {
        const fallbackCode = bankRec?.account_type === 'cash' ? '1001' : '1002';
        const fallback = (await client.query(
          `SELECT id FROM accounts WHERE code=$1 AND tenant_id=$2`, [fallbackCode, tenantId]
        )).rows[0];
        cashAccountId = fallback?.id || null;
      }
    }

    if (!cashAccountId) {
      throw new Error('Could not resolve a GL account for the payment. Ensure the bank account has a linked GL account.');
    }

    const entryRes = await client.query(
      `INSERT INTO journal_entries (tenant_id, date, description, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, payment_date, `Payment for Invoice #${invoice.invoice_number} (${payment_method})`, userId]
    );
    // Dr specific Cash/Bank GL (money received), Cr Accounts Receivable (clears what was owed)
    await client.query(
      `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0), ($1, $4, 0, $3)`,
      [entryRes.rows[0].id, cashAccountId, amount, arAccountId]
    );
    await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [amount, cashAccountId]);
    await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [amount, arAccountId]);

    // ─── CREDIT BANK ACCOUNT (Banking module) ────────────────────────────────
    if (effectiveBankId) {
      await client.query(
        `UPDATE bank_accounts SET current_balance = current_balance + $1 WHERE id = $2 AND tenant_id = $3`,
        [amount, effectiveBankId, tenantId]
      );
      await client.query(
        `INSERT INTO bank_transactions (tenant_id, bank_account_id, transaction_date, description, amount, transaction_type, reference)
         VALUES ($1, $2, $3, $4, $5, 'credit', $6)`,
        [tenantId, effectiveBankId, payment_date, `Invoice payment — ${invoice.invoice_number}`, amount, reference || `INV-PAY-${invoice_id}`]
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'payment', invoice_id, `Recorded payment of ${amount} for invoice ${invoice_id}`);
    res.status(201).json({ message: "Payment recorded" });
  } catch (err) {
    await client.query('ROLLBACK');
    return handleError(res, err);
  } finally {
    client.release();
  }
};

export const getPayments = async (req, res) => {
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `SELECT p.*, c.name as customer_name, i.invoice_number FROM payments p 
       LEFT JOIN customers c ON p.customer_id = c.id LEFT JOIN invoices i ON p.invoice_id = i.id 
       WHERE p.tenant_id = $1 ORDER BY p.created_at DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getARSummary = async (req, res) => {
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as total_invoices, 
              SUM(total_amount) as total_invoiced, 
              SUM(amount_paid) as total_paid, 
              SUM(balance_due) as total_outstanding,
              COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
              COUNT(*) FILTER (WHERE status != 'paid' OR status IS NULL) as open_invoices
       FROM invoices WHERE tenant_id = $1`,
      [tenantId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// ─── INVOICE EDIT / DELETE ───────────────────────────────
export const updateInvoice = async (req, res) => {
  const { id } = req.params;
  const { due_date, notes, status } = req.body;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `UPDATE invoices SET
         due_date  = COALESCE($1, due_date),
         notes     = COALESCE($2, notes),
         status    = COALESCE($3, status)
       WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [due_date || null, notes ?? null, status || null, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteInvoice = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inv = (await client.query(`SELECT * FROM invoices WHERE id=$1 AND tenant_id=$2`, [id, tenantId])).rows[0];
    if (!inv) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Invoice not found' }); }

    // Reverse journal entry by description match
    const entries = await client.query(
      `SELECT id FROM journal_entries WHERE description=$1 AND tenant_id=$2`,
      [`Invoice #${inv.invoice_number}`, tenantId]
    );
    for (const entry of entries.rows) {
      const lines = (await client.query(`SELECT * FROM journal_lines WHERE journal_entry_id=$1`, [entry.id])).rows;
      for (const l of lines) {
        await client.query(`UPDATE accounts SET balance = balance - $1 + $2 WHERE id=$3`, [l.debit, l.credit, l.account_id]);
      }
      await client.query(`DELETE FROM journal_lines WHERE journal_entry_id=$1`, [entry.id]);
      await client.query(`DELETE FROM journal_entries WHERE id=$1`, [entry.id]);
    }

    await client.query(`DELETE FROM payments WHERE invoice_id=$1`, [id]);
    await client.query(`DELETE FROM invoice_items WHERE invoice_id=$1`, [id]);
    await client.query(`DELETE FROM invoices WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    await client.query('COMMIT');
    logAudit(req, 'DELETE', 'invoice', id, `Deleted invoice ${inv.invoice_number}`);
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ─── PAYMENT DELETE ──────────────────────────────────────
export const deletePayment = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pay = (await client.query(`SELECT * FROM payments WHERE id=$1 AND tenant_id=$2`, [id, tenantId])).rows[0];
    if (!pay) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Payment not found' }); }

    // Restore invoice balance
    const inv = (await client.query(`SELECT * FROM invoices WHERE id=$1`, [pay.invoice_id])).rows[0];
    if (inv) {
      const newPaid = Math.max(0, Number(inv.amount_paid) - Number(pay.amount));
      const newBal  = Number(inv.total_amount) - newPaid;
      await client.query(
        `UPDATE invoices SET amount_paid=$1, balance_due=$2, status=$3 WHERE id=$4`,
        [newPaid, newBal, newPaid <= 0 ? 'unpaid' : 'partial', pay.invoice_id]
      );
    }

    await client.query(`DELETE FROM payments WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    await client.query('COMMIT');
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
