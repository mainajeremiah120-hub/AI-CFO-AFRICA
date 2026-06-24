import pool from '../../config/db.js';

// ─── CUSTOMERS ───────────────────────────────────────────
export const createCustomer = async (req, res) => {
  const { name, email, phone, address, customer_type } = req.body;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `INSERT INTO customers (tenant_id, name, email, phone, address, customer_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenantId, name, email, phone, address, customer_type || 'individual']
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
  const { name, email, phone, address, customer_type } = req.body;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `UPDATE customers SET name=$1, email=$2, phone=$3, address=$4, customer_type=$5
       WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [name, email, phone, address, customer_type, id, tenantId]
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
    
    // 1. Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const tax_amount = (subtotal * (tax_rate || 0)) / 100;
    const total_amount = subtotal + tax_amount;

    // 2. Corrected INSERT with 11 placeholders matching 11 columns
    const invoiceResult = await client.query(
      `INSERT INTO invoices (tenant_id, customer_id, invoice_number, date, due_date, subtotal, tax_amount, total_amount, balance_due, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [tenantId, customer_id, invoice_number, date, due_date, subtotal, tax_amount, total_amount, total_amount, notes, userId]
    );
    const invoiceId = invoiceResult.rows[0].id;

    // 3. Insert items
    for (const item of items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES ($1, $2, $3, $4, $5)`,
        [invoiceId, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );
    }

    // 4. Create Journal Entry
    const entryRes = await client.query(
      `INSERT INTO journal_entries (tenant_id, date, description, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, date, `Invoice #${invoice_number}`, userId]
    );

    // Fetch account UUIDs by code
    const arAccountRes = await client.query(`SELECT id FROM accounts WHERE code = '1003' AND tenant_id = $1`, [tenantId]);
    const salesAccountRes = await client.query(`SELECT id FROM accounts WHERE code = '4001' AND tenant_id = $1`, [tenantId]);
    
    if (arAccountRes.rows.length === 0 || salesAccountRes.rows.length === 0) {
      throw new Error("Required accounting codes (1003 or 4001) are missing from Chart of Accounts.");
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
      `SELECT i.*, c.name as customer_name, json_agg(json_build_object('id', ii.id, 'description', ii.description, 'quantity', ii.quantity, 'unit_price', ii.unit_price, 'total', ii.total)) as items
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
       WHERE i.tenant_id = $1 GROUP BY i.id, c.name ORDER BY i.created_at DESC`,
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
  const { invoice_id, amount, payment_date, payment_method, reference, notes } = req.body;
  const { tenantId, userId } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const invoice = (await client.query(`SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2`, [invoice_id, tenantId])).rows[0];
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    await client.query(`INSERT INTO payments (tenant_id, invoice_id, customer_id, amount, payment_date, payment_method, reference, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [tenantId, invoice_id, invoice.customer_id, amount, payment_date, payment_method, reference, notes]);

    const new_paid = Number(invoice.amount_paid || 0) + Number(amount);
    await client.query(`UPDATE invoices SET amount_paid = $1, balance_due = $2, status = $3 WHERE id = $4`,
      [new_paid, Number(invoice.total_amount) - new_paid, new_paid >= invoice.total_amount ? 'paid' : 'partial', invoice_id]);

    // Fetch account UUIDs — route to correct account based on payment method
    // cash → 1001 (Cash at Hand), bank/mpesa/cheque → 1002 (Bank Account)
    const cashAccountCode = payment_method === 'cash' ? '1001' : '1002';
    const cashAccountRes = await client.query(
      `SELECT id FROM accounts WHERE code = $1 AND tenant_id = $2`, [cashAccountCode, tenantId]
    );
    const arAccountRes = await client.query(`SELECT id FROM accounts WHERE code = '1003' AND tenant_id = $1`, [tenantId]);
    
    if (cashAccountRes.rows.length === 0) {
      throw new Error(`Account ${cashAccountCode} (${payment_method === 'cash' ? 'Cash at Hand' : 'Bank Account'}) is missing from Chart of Accounts.`);
    }
    if (arAccountRes.rows.length === 0) {
      throw new Error("Account 1003 (Accounts Receivable) is missing from Chart of Accounts.");
    }
    const cashAccountId = cashAccountRes.rows[0].id;
    const arAccountId = arAccountRes.rows[0].id;

    const entryRes = await client.query(`INSERT INTO journal_entries (tenant_id, date, description, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, payment_date, `Payment for Invoice #${invoice.invoice_number} (${payment_method})`, userId]);
    // Dr Cash/Bank (money received), Cr Accounts Receivable (clears what was owed)
    await client.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0), ($1, $4, 0, $3)`, 
        [entryRes.rows[0].id, cashAccountId, amount, arAccountId]);
    await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [amount, cashAccountId]);
    await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [amount, arAccountId]);

    await client.query('COMMIT');
    res.status(201).json({ message: "Payment recorded" });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
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