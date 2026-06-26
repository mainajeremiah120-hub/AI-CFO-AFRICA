import pool from '../../config/db.js';

// ─── VENDORS ─────────────────────────────────────────────

export const createVendor = async (req, res) => {
  const { name, email, phone, kra_pin, payment_terms } = req.body;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `INSERT INTO vendors (tenant_id, name, email, phone, kra_pin, payment_terms)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenantId, name, email, phone, kra_pin, payment_terms]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getVendors = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT * FROM vendors WHERE tenant_id = $1 ORDER BY name ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateVendor = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, kra_pin, payment_terms } = req.body;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `UPDATE vendors SET name=$1, email=$2, phone=$3, kra_pin=$4, payment_terms=$5
       WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [name, email, phone, kra_pin, payment_terms, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vendor not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteVendor = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  try {
    await pool.query(`DELETE FROM vendors WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    res.json({ message: 'Vendor deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── REQUISITIONS ─────────────────────────────────────────

export const createRequisition = async (req, res) => {
  const { requester_name, department, description } = req.body;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `INSERT INTO requisitions (tenant_id, requester_name, department, description, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [tenantId, requester_name, department, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getRequisitions = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT * FROM requisitions WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateRequisitionStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `UPDATE requisitions SET status = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [status, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Requisition not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── PURCHASE ORDERS ──────────────────────────────────────

export const createPurchaseOrder = async (req, res) => {
  const { vendor_id, po_number, order_date, items, notes } = req.body;
  const { tenantId } = req.user;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const total_amount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    const poResult = await client.query(
      `INSERT INTO purchase_orders (tenant_id, vendor_id, po_number, order_date, total_amount, status)
       VALUES ($1, $2, $3, $4, $5, 'open') RETURNING *`,
      [tenantId, vendor_id, po_number, order_date || new Date(), total_amount]
    );
    const po = poResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO po_items (po_id, item_name, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [po.id, item.item_name, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(po);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getPurchaseOrders = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT po.*, v.name as vendor_name, v.email as vendor_email,
        json_agg(json_build_object(
          'id', pi.id,
          'item_name', pi.item_name,
          'quantity', pi.quantity,
          'unit_price', pi.unit_price,
          'total_price', pi.total_price
        )) as items
       FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.id
       LEFT JOIN po_items pi ON po.id = pi.po_id
       WHERE po.tenant_id = $1
       GROUP BY po.id, v.name, v.email
       ORDER BY po.created_at DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GOODS RECEIVED ───────────────────────────────────────

export const receiveGoods = async (req, res) => {
  const { po_id, received_by, notes, items } = req.body;
  const { tenantId, userId } = req.user;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check PO exists
    const poResult = await client.query(
      `SELECT po.*, v.name as vendor_name FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.id
       WHERE po.id = $1 AND po.tenant_id = $2`,
      [po_id, tenantId]
    );
    const po = poResult.rows[0];
    if (!po) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Record goods received
    const grResult = await client.query(
      `INSERT INTO goods_received (po_id, tenant_id, delivery_date, received_by, notes)
       VALUES ($1, $2, NOW(), $3, $4) RETURNING *`,
      [po_id, tenantId, received_by, notes]
    );

    // Update PO status to received
    await client.query(
      `UPDATE purchase_orders SET status = 'received' WHERE id = $1`,
      [po_id]
    );

    // ─── WIRE TO INVENTORY (Stock In per item) ───────────────
    if (items && items.length > 0) {
      for (const item of items) {
        if (item.product_id && item.warehouse_id) {
          const existing = await client.query(
            `SELECT * FROM stock_levels WHERE product_id = $1 AND warehouse_id = $2`,
            [item.product_id, item.warehouse_id]
          );

          if (existing.rows.length > 0) {
            await client.query(
              `UPDATE stock_levels SET quantity = quantity + $1 WHERE product_id = $2 AND warehouse_id = $3`,
              [item.quantity, item.product_id, item.warehouse_id]
            );
          } else {
            await client.query(
              `INSERT INTO stock_levels (tenant_id, product_id, warehouse_id, quantity)
               VALUES ($1, $2, $3, $4)`,
              [tenantId, item.product_id, item.warehouse_id, item.quantity]
            );
          }

          await client.query(
            `INSERT INTO stock_movements (tenant_id, product_id, warehouse_id, movement_type, quantity, reason, reference, created_by)
             VALUES ($1, $2, $3, 'in', $4, 'Goods received from PO', $5, $6)`,
            [tenantId, item.product_id, item.warehouse_id, item.quantity, po.po_number, userId]
          );
        }
      }
    }

    // ─── WIRE TO PAYABLES (Auto-create bill) ─────────────────
    const billResult = await client.query(
      `INSERT INTO bills (tenant_id, supplier_id, bill_number, date, due_date, subtotal, tax_rate, tax_amount, total_amount, balance_due, notes, created_by)
       SELECT $1, v.id, $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', $3, 0, 0, $3, $3, $4, $5
       FROM vendors v WHERE v.id = $6 AND v.tenant_id = $1
       RETURNING *`,
      [tenantId, `BILL-${po.po_number}`, po.total_amount, `Auto-generated from PO ${po.po_number}`, userId, po.vendor_id]
    );

    // ─── WIRE TO ACCOUNTING (Journal Entry) ──────────────────
    const inventoryAccount = await client.query(
      `SELECT id FROM accounts WHERE tenant_id = $1 AND code = '1005'`, [tenantId]
    );
    const payableAccount = await client.query(
      `SELECT id FROM accounts WHERE tenant_id = $1 AND code = '1004'`, [tenantId]
    );

    if (inventoryAccount.rows[0] && payableAccount.rows[0]) {
      const entryResult = await client.query(
        `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
         VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
        [tenantId, `Goods received — PO ${po.po_number}`, po.po_number, userId]
      );
      const entry = entryResult.rows[0];

      // Debit Inventory
      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
        [entry.id, inventoryAccount.rows[0].id, po.total_amount]
      );
      await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [po.total_amount, inventoryAccount.rows[0].id]
      );

      // Credit Payable Account
      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
        [entry.id, payableAccount.rows[0].id, po.total_amount]
      );
      await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
        [po.total_amount, payableAccount.rows[0].id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      goods_received: grResult.rows[0],
      bill: billResult.rows[0] || null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getGoodsReceived = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT gr.*, po.po_number, po.total_amount, v.name as vendor_name
       FROM goods_received gr
       LEFT JOIN purchase_orders po ON gr.po_id = po.id
       LEFT JOIN vendors v ON po.vendor_id = v.id
       WHERE gr.tenant_id = $1
       ORDER BY gr.delivery_date DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── VENDOR INVOICES ──────────────────────────────────────

export const createVendorInvoice = async (req, res) => {
  const { po_id, invoice_number, invoice_date, due_date, amount_due } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO vendor_invoices (po_id, invoice_number, invoice_date, due_date, amount_due, status)
       VALUES ($1, $2, $3, $4, $5, 'unpaid') RETURNING *`,
      [po_id, invoice_number, invoice_date, due_date, amount_due]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getVendorInvoices = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT vi.*, po.po_number, po.tenant_id, v.name as vendor_name
       FROM vendor_invoices vi
       LEFT JOIN purchase_orders po ON vi.po_id = po.id
       LEFT JOIN vendors v ON po.vendor_id = v.id
       WHERE po.tenant_id = $1
       ORDER BY vi.invoice_date DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── SUMMARY ─────────────────────────────────────────────

export const getProcurementSummary = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const pos = await pool.query(
      `SELECT
        COUNT(*) as total_orders,
        SUM(total_amount) as total_value,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_orders,
        SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) as received_orders
       FROM purchase_orders WHERE tenant_id = $1`,
      [tenantId]
    );

    const requisitions = await pool.query(
      `SELECT
        COUNT(*) as total_requisitions,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_requisitions,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_requisitions
       FROM requisitions WHERE tenant_id = $1`,
      [tenantId]
    );

    res.json({
      ...pos.rows[0],
      ...requisitions.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// ─── TRANSACTION DELETE / UPDATE ─────────────────────────
export const deleteRequisition = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(`DELETE FROM requisitions WHERE id=$1 AND tenant_id=$2 RETURNING id`, [id, tenantId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Requisition not found' });
    res.json({ message: 'Requisition deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updatePurchaseOrder = async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `UPDATE purchase_orders SET status=COALESCE($1,status) WHERE id=$2 AND tenant_id=$3 RETURNING *`,
      [status || null, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Purchase order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deletePurchaseOrder = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const po = (await client.query(`SELECT id FROM purchase_orders WHERE id=$1 AND tenant_id=$2`, [id, tenantId])).rows[0];
    if (!po) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Purchase order not found' }); }
    await client.query(`DELETE FROM po_items WHERE po_id=$1`, [id]);
    await client.query(`DELETE FROM purchase_orders WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    await client.query('COMMIT');
    res.json({ message: 'Purchase order deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const deleteGoodsReceived = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(`DELETE FROM goods_received WHERE id=$1 AND tenant_id=$2 RETURNING id`, [id, tenantId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: 'Goods received record deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteVendorInvoice = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(`DELETE FROM vendor_invoices WHERE id=$1 AND tenant_id=$2 RETURNING id`, [id, tenantId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vendor invoice not found' });
    res.json({ message: 'Vendor invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
