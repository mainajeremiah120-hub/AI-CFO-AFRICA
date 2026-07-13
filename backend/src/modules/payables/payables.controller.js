import pool from '../../config/db.js';
import { assertPositiveAmount, assertStringLength, AppError, handleError } from '../../middleware/validate.js';
import { logAudit } from '../audit/audit.controller.js';

// ─── STARTUP MIGRATIONS ──────────────────────────────────
(async () => {
  try {
    await pool.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS vat_number VARCHAR(50)`);
    await pool.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(15,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(15,2) DEFAULT 0`);
    console.log('[Payables] Startup migrations done');
  } catch (e) {
    console.error('[Payables] Migration error:', e.message);
  }
})();

// ─── SUPPLIERS ───────────────────────────────────────────

export const createSupplier = async (req, res) => {
  const { name, email, phone, address, supplier_type, vat_number } = req.body;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `INSERT INTO suppliers (tenant_id, name, email, phone, address, supplier_type, vat_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, name, email, phone, address, supplier_type || 'company', vat_number || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getSuppliers = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT * FROM suppliers WHERE tenant_id = $1 AND is_active = true ORDER BY name ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateSupplier = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, address, supplier_type, vat_number } = req.body;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `UPDATE suppliers SET name=$1, email=$2, phone=$3, address=$4, supplier_type=$5, vat_number=$6
       WHERE id=$7 AND tenant_id=$8 RETURNING *`,
      [name, email, phone, address, supplier_type, vat_number || null, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteSupplier = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  try {
    await pool.query(
      `UPDATE suppliers SET is_active=false WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    res.json({ message: 'Supplier deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── BILLS ───────────────────────────────────────────────

export const createBill = async (req, res) => {
  const { supplier_id, bill_number, date, due_date, items, tax_rate, notes } = req.body;
  const { tenantId, userId } = req.user;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const tax_amount = (subtotal * (tax_rate || 0)) / 100;
    const total_amount = subtotal + tax_amount;
    // Per-item VAT
    const total_vat_amount = items.reduce((sum, item) => {
      const rate = item.vat_rate !== undefined ? Number(item.vat_rate) : 16;
      return sum + (item.quantity * item.unit_price * rate / 100);
    }, 0);

    const billResult = await client.query(
      `INSERT INTO bills (tenant_id, supplier_id, bill_number, date, due_date, subtotal, tax_rate, tax_amount, total_amount, balance_due, notes, created_by, vat_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, $12) RETURNING *`,
      [tenantId, supplier_id, bill_number, date, due_date, subtotal, tax_rate || 0, tax_amount, total_amount, notes, userId, total_vat_amount]
    );
    const bill = billResult.rows[0];

    for (const item of items) {
      const itemVatRate = item.vat_rate !== undefined ? Number(item.vat_rate) : 16;
      const itemVatAmount = item.quantity * item.unit_price * itemVatRate / 100;
      await client.query(
        `INSERT INTO bill_items (bill_id, description, quantity, unit_price, total, vat_rate, vat_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [bill.id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price, itemVatRate, itemVatAmount]
      );
    }

    // ─── JOURNAL ENTRY: Dr Expenses (5001), Cr Payball A/P (1004) ───
    const expenseAccountRes = await client.query(
      `SELECT id FROM accounts WHERE code = '5001' AND tenant_id = $1`, [tenantId]
    );
    const apAccountRes = await client.query(
      `SELECT id FROM accounts WHERE code = '1004' AND tenant_id = $1`, [tenantId]
    );

    if (expenseAccountRes.rows.length === 0 || apAccountRes.rows.length === 0) {
      throw new Error("Required accounting codes (5001 or 1004) are missing from Chart of Accounts. Please create them before creating bills.");
    }
    const expenseAccountId = expenseAccountRes.rows[0].id;
    const apAccountId = apAccountRes.rows[0].id;

    const entryRes = await client.query(
      `INSERT INTO journal_entries (tenant_id, date, description, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, date, `Bill #${bill_number}`, userId]
    );

    // Dr Expenses, Cr Payball A/P
    await client.query(
      `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0), ($1, $4, 0, $3)`,
      [entryRes.rows[0].id, expenseAccountId, total_amount, apAccountId]
    );

    // Update account balances
    await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2 AND tenant_id = $3`, [total_amount, expenseAccountId, tenantId]);
    await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND tenant_id = $3`, [total_amount, apAccountId, tenantId]);
    // ────────────────────────────────────────────────────────────────

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'bill', bill.id, `Created bill ${bill_number} for supplier ${supplier_id}`);
    res.status(201).json(bill);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getBills = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT b.*, s.name as supplier_name, s.email as supplier_email
       FROM bills b
       LEFT JOIN suppliers s ON b.supplier_id = s.id
       WHERE b.tenant_id = $1
       ORDER BY b.created_at DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getBill = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT b.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone,
        json_agg(json_build_object(
          'id', bi.id,
          'description', bi.description,
          'quantity', bi.quantity,
          'unit_price', bi.unit_price,
          'total', bi.total
        )) as items
       FROM bills b
       LEFT JOIN suppliers s ON b.supplier_id = s.id
       LEFT JOIN bill_items bi ON b.id = bi.bill_id
       WHERE b.id = $1 AND b.tenant_id = $2
       GROUP BY b.id, s.name, s.email, s.phone`,
      [id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Bill not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── BILL PAYMENTS ───────────────────────────────────────

export const recordBillPayment = async (req, res) => {
  const { bill_id, amount, payment_date, payment_method, reference, notes, bank_account_id } = req.body;
  const { tenantId, userId } = req.user;

  const client = await pool.connect();

  try {
    assertPositiveAmount(amount, 'Payment amount');
    assertStringLength(reference, 'Reference', 100);
    assertStringLength(notes, 'Notes', 500);

    await client.query('BEGIN');

    const billResult = await client.query(
      `SELECT * FROM bills WHERE id = $1 AND tenant_id = $2`,
      [bill_id, tenantId]
    );
    const bill = billResult.rows[0];
    if (!bill) throw new AppError('Bill not found', 404);

    const payAmt = Math.round(Number(amount) * 100) / 100;
    if (payAmt > Number(bill.balance_due) + 0.01) {
      throw new AppError(`Payment (${payAmt}) exceeds bill balance due (${bill.balance_due})`);
    }

    const paymentResult = await client.query(
      `INSERT INTO bill_payments (tenant_id, bill_id, supplier_id, amount, payment_date, payment_method, reference, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [tenantId, bill_id, bill.supplier_id, amount, payment_date, payment_method, reference, notes]
    );

    const new_amount_paid = Number(bill.amount_paid) + Number(amount);
    const new_balance_due = Number(bill.total_amount) - new_amount_paid;
    const new_status = new_balance_due <= 0 ? 'paid' : new_amount_paid > 0 ? 'partial' : 'unpaid';

    await client.query(
      `UPDATE bills SET amount_paid = $1, balance_due = $2, status = $3 WHERE id = $4`,
      [new_amount_paid, new_balance_due, new_status, bill_id]
    );

    // ─── JOURNAL ENTRY: Dr Payball A/P (1004), Cr Cash/Bank based on payment method ───
    const apAccountRes = await client.query(
      `SELECT id FROM accounts WHERE code = '1004' AND tenant_id = $1`, [tenantId]
    );

    if (apAccountRes.rows.length === 0) {
      throw new Error("Account 1004 (Accounts Payable) is missing from Chart of Accounts.");
    }
    const apAccountId = apAccountRes.rows[0].id;

    // ─── Resolve which bank account and its specific GL account ──────────────
    // Use the provided bank_account_id, or auto-pick the first matching type
    let effectiveBankId = bank_account_id || null;
    if (!effectiveBankId) {
      const targetType = payment_method === 'cash' ? 'cash' : 'bank';
      const primaryAcc = await client.query(
        `SELECT id FROM bank_accounts WHERE tenant_id=$1 AND account_type=$2 AND is_active=true ORDER BY created_at ASC LIMIT 1`,
        [tenantId, targetType]
      );
      effectiveBankId = primaryAcc.rows[0]?.id || null;
    }

    // Get the specific GL account linked to this bank account
    let cashAccountId = null;
    if (effectiveBankId) {
      const bankRec = (await client.query(
        `SELECT gl_account_id, account_type FROM bank_accounts WHERE id=$1 AND tenant_id=$2`,
        [effectiveBankId, tenantId]
      )).rows[0];
      if (bankRec?.gl_account_id) {
        cashAccountId = bankRec.gl_account_id;
      } else {
        // Fall back to generic code if bank account has no GL link yet
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
      [tenantId, payment_date, `Payment for Bill #${bill.bill_number} (${payment_method})`, userId]
    );

    // Dr Accounts Payable (clears liability), Cr specific Bank/Cash GL (money goes out)
    await client.query(
      `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0), ($1, $4, 0, $3)`,
      [entryRes.rows[0].id, apAccountId, amount, cashAccountId]
    );
    await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2 AND tenant_id = $3`, [amount, apAccountId, tenantId]);
    await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND tenant_id = $3`, [amount, cashAccountId, tenantId]);

    // ─── DEDUCT FROM BANK ACCOUNT (Banking module) ───────────────────────────
    if (effectiveBankId) {
      await client.query(
        `UPDATE bank_accounts SET current_balance = current_balance - $1 WHERE id = $2 AND tenant_id = $3`,
        [amount, effectiveBankId, tenantId]
      );
      await client.query(
        `INSERT INTO bank_transactions (tenant_id, bank_account_id, transaction_date, description, amount, transaction_type, reference)
         VALUES ($1, $2, $3, $4, $5, 'debit', $6)`,
        [tenantId, effectiveBankId, payment_date, `Bill payment — ${bill.bill_number}`, amount, reference || `BILL-PAY-${bill_id}`]
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'bill_payment', bill_id, `Recorded bill payment of ${amount} for bill ${bill_id}`);
    res.status(201).json(paymentResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    return handleError(res, err);
  } finally {
    client.release();
  }
};

export const getBillPayments = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT bp.*, s.name as supplier_name, b.bill_number
       FROM bill_payments bp
       LEFT JOIN suppliers s ON bp.supplier_id = s.id
       LEFT JOIN bills b ON bp.bill_id = b.id
       WHERE bp.tenant_id = $1
       ORDER BY bp.created_at DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── AP SUMMARY ──────────────────────────────────────────

export const getAPSummary = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT
        COUNT(*) as total_bills,
        SUM(total_amount) as total_billed,
        SUM(amount_paid) as total_paid,
        SUM(balance_due) as total_outstanding,
        SUM(CASE WHEN status = 'overdue' THEN balance_due ELSE 0 END) as total_overdue,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_bills,
        SUM(CASE WHEN status = 'unpaid' OR status = 'partial' THEN 1 ELSE 0 END) as open_bills
       FROM bills
       WHERE tenant_id = $1`,
      [tenantId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// ─── BILL EDIT / DELETE ──────────────────────────────────
export const updateBill = async (req, res) => {
  const { id } = req.params;
  const { due_date, notes, status } = req.body;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `UPDATE bills SET
         due_date = COALESCE($1, due_date),
         notes    = COALESCE($2, notes),
         status   = COALESCE($3, status)
       WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [due_date || null, notes ?? null, status || null, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Bill not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteBill = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bill = (await client.query(`SELECT * FROM bills WHERE id=$1 AND tenant_id=$2`, [id, tenantId])).rows[0];
    if (!bill) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Bill not found' }); }

    const entries = await client.query(
      `SELECT id FROM journal_entries WHERE description=$1 AND tenant_id=$2`,
      [`Bill #${bill.bill_number}`, tenantId]
    );
    for (const entry of entries.rows) {
      const lines = (await client.query(`SELECT * FROM journal_lines WHERE journal_entry_id=$1`, [entry.id])).rows;
      for (const l of lines) {
        await client.query(`UPDATE accounts SET balance = balance - $1 + $2 WHERE id=$3`, [l.debit, l.credit, l.account_id]);
      }
      await client.query(`DELETE FROM journal_lines WHERE journal_entry_id=$1`, [entry.id]);
      await client.query(`DELETE FROM journal_entries WHERE id=$1`, [entry.id]);
    }

    await client.query(`DELETE FROM bill_payments WHERE bill_id=$1`, [id]);
    await client.query(`DELETE FROM bill_items WHERE bill_id=$1`, [id]);
    await client.query(`DELETE FROM bills WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    await client.query('COMMIT');
    logAudit(req, 'DELETE', 'bill', id, `Deleted bill ${bill.bill_number}`);
    res.json({ message: 'Bill deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ─── BILL PAYMENT DELETE ─────────────────────────────────
export const deleteBillPayment = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pay = (await client.query(`SELECT * FROM bill_payments WHERE id=$1 AND tenant_id=$2`, [id, tenantId])).rows[0];
    if (!pay) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Payment not found' }); }

    const bill = (await client.query(`SELECT * FROM bills WHERE id=$1`, [pay.bill_id])).rows[0];
    if (bill) {
      const newPaid = Math.max(0, Number(bill.amount_paid) - Number(pay.amount));
      const newBal  = Number(bill.total_amount) - newPaid;
      await client.query(
        `UPDATE bills SET amount_paid=$1, balance_due=$2, status=$3 WHERE id=$4`,
        [newPaid, newBal, newPaid <= 0 ? 'unpaid' : 'partial', pay.bill_id]
      );
    }

    await client.query(`DELETE FROM bill_payments WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    await client.query('COMMIT');
    res.json({ message: 'Bill payment deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
