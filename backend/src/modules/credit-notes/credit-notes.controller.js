import pool from '../../config/db.js';

// ─── Startup migration ────────────────────────────────────────────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_notes (
        id            SERIAL PRIMARY KEY,
        tenant_id     INTEGER NOT NULL,
        reference     VARCHAR(100) NOT NULL,
        type          VARCHAR(50) NOT NULL,
        date          DATE NOT NULL DEFAULT CURRENT_DATE,
        amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
        description   TEXT,
        customer_id   INTEGER,
        supplier_id   INTEGER,
        invoice_id    INTEGER,
        bill_id       INTEGER,
        product_id    INTEGER,
        quantity      NUMERIC(10,2),
        bank_account_id INTEGER,
        payment_method  VARCHAR(30),
        status        VARCHAR(20) DEFAULT 'posted',
        created_by    INTEGER,
        created_at    TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error('Credit notes migration error:', err.message);
  }
})();

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function getAcct(client, code, tenantId) {
  const r = await client.query(
    `SELECT id FROM accounts WHERE code = $1 AND tenant_id = $2`,
    [code, tenantId]
  );
  if (r.rows.length === 0) throw new Error(`Account ${code} missing from Chart of Accounts`);
  return r.rows[0].id;
}

async function postJournal(client, tenantId, date, description, userId, drAcctId, crAcctId, amount) {
  const entry = await client.query(
    `INSERT INTO journal_entries (tenant_id, date, description, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
    [tenantId, date, description, userId]
  );
  const eid = entry.rows[0].id;
  await client.query(
    `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit)
     VALUES ($1,$2,$3,0),($1,$4,0,$3)`,
    [eid, drAcctId, amount, crAcctId]
  );
  await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [amount, drAcctId]);
  await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [amount, crAcctId]);
  return eid;
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
export const createCreditNote = async (req, res) => {
  const {
    type, date, amount, description, reference,
    customer_id, supplier_id, invoice_id, bill_id,
    product_id, quantity, bank_account_id, payment_method
  } = req.body;
  const { tenantId, userId } = req.user;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const ref = reference || `CN-${Date.now()}`;
    let drAcct, crAcct;

    // ── Determine journal accounts by type ──────────────────────────────────
    if (type === 'customer_return') {
      // Dr Revenue → Cr Receivable (reverse the original invoice)
      drAcct = await getAcct(client, '4002', tenantId);
      crAcct = await getAcct(client, '1003', tenantId);
    } else if (type === 'supplier_return') {
      // Dr Payable → Cr Inventory (return goods to supplier)
      drAcct = await getAcct(client, '1004', tenantId);
      crAcct = await getAcct(client, '1005', tenantId);
    } else if (type === 'stock_spoilage') {
      // Dr General Expenses → Cr Inventory (write off damaged stock)
      drAcct = await getAcct(client, '5001', tenantId);
      crAcct = await getAcct(client, '1005', tenantId);
    } else if (type === 'payment_reversal_invoice') {
      // Dr Receivable → Cr Bank/Cash (reverse invoice payment)
      const cashCode = payment_method === 'cash' ? '1001' : '1002';
      drAcct = await getAcct(client, '1003', tenantId);
      crAcct = await getAcct(client, cashCode, tenantId);
    } else if (type === 'payment_reversal_bill') {
      // Dr Bank/Cash → Cr Payable (reverse bill payment)
      const cashCode = payment_method === 'cash' ? '1001' : '1002';
      drAcct = await getAcct(client, cashCode, tenantId);
      crAcct = await getAcct(client, '1004', tenantId);
    } else {
      throw new Error(`Unknown credit note type: ${type}`);
    }

    // ── Post journal entry ───────────────────────────────────────────────────
    await postJournal(
      client, tenantId, date,
      `Credit Note ${ref} — ${type.replace(/_/g, ' ')}`,
      userId, drAcct, crAcct, Number(amount)
    );

    // ── Side effects per type ────────────────────────────────────────────────
    if (type === 'customer_return' && invoice_id) {
      await client.query(
        `UPDATE invoices SET balance_due = GREATEST(0, balance_due - $1),
         status = CASE WHEN balance_due - $1 <= 0 THEN 'paid'
                       WHEN balance_due - $1 < total_amount THEN 'partial'
                       ELSE status END
         WHERE id = $2 AND tenant_id = $3`,
        [Number(amount), invoice_id, tenantId]
      );
    }

    if (type === 'supplier_return' && bill_id) {
      await client.query(
        `UPDATE bills SET balance_due = GREATEST(0, balance_due - $1),
         status = CASE WHEN balance_due - $1 <= 0 THEN 'paid'
                       WHEN balance_due - $1 < total_amount THEN 'partial'
                       ELSE status END
         WHERE id = $2 AND tenant_id = $3`,
        [Number(amount), bill_id, tenantId]
      );
    }

    if (type === 'stock_spoilage' && product_id && quantity) {
      await client.query(
        `UPDATE inventory SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1)
         WHERE product_id = $2 AND tenant_id = $3`,
        [Number(quantity), product_id, tenantId]
      );
    }

    if (type === 'payment_reversal_invoice' && invoice_id) {
      await client.query(
        `UPDATE invoices SET balance_due = balance_due + $1,
         amount_paid = GREATEST(0, amount_paid - $1),
         status = CASE WHEN amount_paid - $1 <= 0 THEN 'unpaid'
                       ELSE 'partial' END
         WHERE id = $2 AND tenant_id = $3`,
        [Number(amount), invoice_id, tenantId]
      );
    }

    if (type === 'payment_reversal_bill' && bill_id) {
      await client.query(
        `UPDATE bills SET balance_due = balance_due + $1,
         amount_paid = GREATEST(0, amount_paid - $1),
         status = CASE WHEN amount_paid - $1 <= 0 THEN 'unpaid'
                       ELSE 'partial' END
         WHERE id = $2 AND tenant_id = $3`,
        [Number(amount), bill_id, tenantId]
      );
    }

    // ── Reverse bank account if specified (payment reversals) ────────────────
    if (bank_account_id && (type === 'payment_reversal_invoice' || type === 'payment_reversal_bill')) {
      const direction = type === 'payment_reversal_invoice' ? -1 : 1;
      await client.query(
        `UPDATE bank_accounts SET current_balance = current_balance + $1 WHERE id = $2 AND tenant_id = $3`,
        [direction * Number(amount), bank_account_id, tenantId]
      );
      await client.query(
        `INSERT INTO bank_transactions (tenant_id, bank_account_id, transaction_date, description, amount, transaction_type, reference)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [tenantId, bank_account_id, date, `Credit Note ${ref}`, Number(amount),
         type === 'payment_reversal_invoice' ? 'debit' : 'credit', ref]
      );
    }

    // ── Save credit note record ──────────────────────────────────────────────
    const result = await client.query(
      `INSERT INTO credit_notes
         (tenant_id, reference, type, date, amount, description,
          customer_id, supplier_id, invoice_id, bill_id,
          product_id, quantity, bank_account_id, payment_method, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'posted',$15) RETURNING *`,
      [tenantId, ref, type, date, Number(amount), description,
       customer_id || null, supplier_id || null, invoice_id || null, bill_id || null,
       product_id || null, quantity || null, bank_account_id || null, payment_method || null, userId]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ─── LIST ─────────────────────────────────────────────────────────────────────
export const getCreditNotes = async (req, res) => {
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `SELECT cn.*,
              c.name  AS customer_name,
              s.name  AS supplier_name,
              i.invoice_number,
              b.bill_number
       FROM credit_notes cn
       LEFT JOIN customers  c ON cn.customer_id  = c.id
       LEFT JOIN suppliers  s ON cn.supplier_id  = s.id
       LEFT JOIN invoices   i ON cn.invoice_id   = i.id
       LEFT JOIN bills      b ON cn.bill_id      = b.id
       WHERE cn.tenant_id = $1
       ORDER BY cn.created_at DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── VOID (soft reversal) ─────────────────────────────────────────────────────
export const voidCreditNote = async (req, res) => {
  const { id } = req.params;
  const { tenantId, userId } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cn = (await client.query(
      `SELECT * FROM credit_notes WHERE id=$1 AND tenant_id=$2`, [id, tenantId]
    )).rows[0];
    if (!cn) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Credit note not found' }); }
    if (cn.status === 'void') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Already void' }); }

    // Post the exact opposite journal entry
    let drAcct, crAcct;
    const cashCode = cn.payment_method === 'cash' ? '1001' : '1002';
    if (cn.type === 'customer_return') {
      drAcct = await getAcct(client, '1003', tenantId);
      crAcct = await getAcct(client, '4002', tenantId);
    } else if (cn.type === 'supplier_return') {
      drAcct = await getAcct(client, '1005', tenantId);
      crAcct = await getAcct(client, '1004', tenantId);
    } else if (cn.type === 'stock_spoilage') {
      drAcct = await getAcct(client, '1005', tenantId);
      crAcct = await getAcct(client, '5001', tenantId);
    } else if (cn.type === 'payment_reversal_invoice') {
      drAcct = await getAcct(client, cashCode, tenantId);
      crAcct = await getAcct(client, '1003', tenantId);
    } else if (cn.type === 'payment_reversal_bill') {
      drAcct = await getAcct(client, '1004', tenantId);
      crAcct = await getAcct(client, cashCode, tenantId);
    }

    await postJournal(
      client, tenantId, new Date().toISOString().split('T')[0],
      `Void Credit Note ${cn.reference}`, userId, drAcct, crAcct, Number(cn.amount)
    );

    // Reverse side effects
    if (cn.type === 'customer_return' && cn.invoice_id) {
      await client.query(
        `UPDATE invoices SET balance_due = balance_due + $1, status='partial' WHERE id=$2 AND tenant_id=$3`,
        [Number(cn.amount), cn.invoice_id, tenantId]
      );
    }
    if (cn.type === 'supplier_return' && cn.bill_id) {
      await client.query(
        `UPDATE bills SET balance_due = balance_due + $1, status='partial' WHERE id=$2 AND tenant_id=$3`,
        [Number(cn.amount), cn.bill_id, tenantId]
      );
    }
    if (cn.type === 'stock_spoilage' && cn.product_id && cn.quantity) {
      await client.query(
        `UPDATE inventory SET quantity_on_hand = quantity_on_hand + $1 WHERE product_id=$2 AND tenant_id=$3`,
        [Number(cn.quantity), cn.product_id, tenantId]
      );
    }

    await client.query(
      `UPDATE credit_notes SET status='void' WHERE id=$1`, [id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Credit note voided' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
export const deleteCreditNote = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  try {
    await pool.query(`DELETE FROM credit_notes WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    res.json({ message: 'Credit note deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
export const getCreditNoteSummary = async (req, res) => {
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='posted') AS total_posted,
         COUNT(*) FILTER (WHERE status='void')   AS total_void,
         COALESCE(SUM(amount) FILTER (WHERE status='posted' AND type='customer_return'),    0) AS customer_returns,
         COALESCE(SUM(amount) FILTER (WHERE status='posted' AND type='supplier_return'),    0) AS supplier_returns,
         COALESCE(SUM(amount) FILTER (WHERE status='posted' AND type='stock_spoilage'),     0) AS stock_spoilage,
         COALESCE(SUM(amount) FILTER (WHERE status='posted' AND type LIKE 'payment_rev%'),  0) AS payment_reversals,
         COALESCE(SUM(amount) FILTER (WHERE status='posted'), 0) AS total_amount
       FROM credit_notes WHERE tenant_id=$1`,
      [tenantId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
