import pool from '../../config/db.js';

// ─── HELPER: Generate Receipt Number ─────────────────────
const generateReceiptNumber = () => {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `RCP-${dateStr}-${random}`;
};

// ─── HELPER: Generate ETR Number (KRA simulation) ────────
const generateETRNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 90000) + 10000;
  return `ETR${timestamp}${random}`.substring(0, 20);
};

// ─── POS SESSIONS ────────────────────────────────────────

export const openSession = async (req, res) => {
  const { cashier_name, opening_cash } = req.body;
  const { tenantId, userId } = req.user;

  try {
    // Check if there's already an open session
    const existing = await pool.query(
      `SELECT * FROM pos_sessions WHERE tenant_id = $1 AND status = 'open'`,
      [tenantId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'There is already an open POS session' });
    }

    const result = await pool.query(
      `INSERT INTO pos_sessions (tenant_id, cashier_id, cashier_name, opening_cash, status)
       VALUES ($1, $2, $3, $4, 'open') RETURNING *`,
      [tenantId, userId, cashier_name, opening_cash || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const closeSession = async (req, res) => {
  const { id } = req.params;
  const { closing_cash } = req.body;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `UPDATE pos_sessions
       SET status = 'closed', closing_cash = $1, closed_at = NOW()
       WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [closing_cash || 0, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getSessions = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT * FROM pos_sessions WHERE tenant_id = $1 ORDER BY opened_at DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getActiveSession = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT * FROM pos_sessions WHERE tenant_id = $1 AND status = 'open' LIMIT 1`,
      [tenantId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── POS SALES ───────────────────────────────────────────

export const createSale = async (req, res) => {
  const {
    session_id, customer_name, customer_phone,
    items, payment_method, mpesa_reference,
    amount_tendered, discount_amount, tax_rate
  } = req.body;
  const { tenantId, userId } = req.user;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Validate session
    const sessionResult = await client.query(
      `SELECT * FROM pos_sessions WHERE id = $1 AND tenant_id = $2 AND status = 'open'`,
      [session_id, tenantId]
    );
    if (!sessionResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active POS session found' });
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const discountAmt = Number(discount_amount) || 0;
    const taxAmt = ((subtotal - discountAmt) * (Number(tax_rate) || 0)) / 100;
    const totalAmount = subtotal - discountAmt + taxAmt;
    const changeAmount = Number(amount_tendered) > 0 ? Number(amount_tendered) - totalAmount : 0;

    const receiptNumber = generateReceiptNumber();
    const etrNumber = generateETRNumber();

    // Create sale record
    const saleResult = await client.query(
      `INSERT INTO pos_sales (
        tenant_id, session_id, receipt_number, etr_number,
        customer_name, customer_phone, subtotal, tax_amount,
        discount_amount, total_amount, payment_method,
        mpesa_reference, amount_tendered, change_amount, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        tenantId, session_id, receiptNumber, etrNumber,
        customer_name || 'Walk-in Customer', customer_phone,
        subtotal, taxAmt, discountAmt, totalAmount,
        payment_method || 'cash', mpesa_reference,
        amount_tendered || totalAmount, changeAmount, userId
      ]
    );
    const sale = saleResult.rows[0];

    // Get default warehouse
    const warehouseResult = await client.query(
      `SELECT id FROM warehouses WHERE tenant_id = $1 AND is_active = true LIMIT 1`,
      [tenantId]
    );
    const warehouseId = warehouseResult.rows[0]?.id;

    // Get accounting accounts
    const cashAccount = await client.query(
      `SELECT id FROM accounts WHERE tenant_id = $1 AND code = $2`,
      [tenantId, payment_method === 'mpesa' ? '1001' : '1001']
    );
    const revenueAccount = await client.query(
      `SELECT id FROM accounts WHERE tenant_id = $1 AND code = '4001'`, [tenantId]
    );
    const cogsAccount = await client.query(
      `SELECT id FROM accounts WHERE tenant_id = $1 AND code = '5003'`, [tenantId]
    );
    const inventoryAccount = await client.query(
      `SELECT id FROM accounts WHERE tenant_id = $1 AND code = '1005'`, [tenantId]
    );

    // Journal entry for sale
    if (cashAccount.rows[0] && revenueAccount.rows[0]) {
      const entryResult = await client.query(
        `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
         VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
        [tenantId, `POS Sale — ${receiptNumber}`, receiptNumber, userId]
      );
      const entry = entryResult.rows[0];

      // Debit Cash/M-Pesa
      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
        [entry.id, cashAccount.rows[0].id, totalAmount]
      );
      await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [totalAmount, cashAccount.rows[0].id]
      );

      // Credit Revenue
      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
        [entry.id, revenueAccount.rows[0].id, totalAmount]
      );
      await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
        [totalAmount, revenueAccount.rows[0].id]
      );
    }

    let totalCOGS = 0;

    // Process each item
    for (const item of items) {
      // Get product details
      const productResult = await client.query(
        `SELECT * FROM products WHERE id = $1 AND tenant_id = $2`,
        [item.product_id, tenantId]
      );
      const product = productResult.rows[0];
      if (!product) continue;

      const itemTotal = item.quantity * item.unit_price;
      const itemCOGS = item.quantity * product.cost_price;
      totalCOGS += itemCOGS;

      // Insert sale item
      await client.query(
        `INSERT INTO pos_sale_items (sale_id, product_id, product_name, sku, quantity, unit_price, cost_price, discount, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [sale.id, item.product_id, product.name, product.sku, item.quantity, item.unit_price, product.cost_price, item.discount || 0, itemTotal]
      );

      // Deduct stock
      if (warehouseId) {
        const stockResult = await client.query(
          `SELECT * FROM stock_levels WHERE product_id = $1 AND warehouse_id = $2`,
          [item.product_id, warehouseId]
        );

        if (stockResult.rows.length > 0) {
          const newQty = Number(stockResult.rows[0].quantity) - Number(item.quantity);
          if (newQty < 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
          }
          await client.query(
            `UPDATE stock_levels SET quantity = $1 WHERE product_id = $2 AND warehouse_id = $3`,
            [newQty, item.product_id, warehouseId]
          );
        }

        // Record stock movement
        await client.query(
          `INSERT INTO stock_movements (tenant_id, product_id, warehouse_id, movement_type, quantity, reason, reference, created_by)
           VALUES ($1, $2, $3, 'out', $4, 'POS Sale', $5, $6)`,
          [tenantId, item.product_id, warehouseId, item.quantity, receiptNumber, userId]
        );
      }
    }

    // Post COGS journal entry
    if (totalCOGS > 0 && cogsAccount.rows[0] && inventoryAccount.rows[0]) {
      const cogsEntryResult = await client.query(
        `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
         VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
        [tenantId, `COGS — POS Sale ${receiptNumber}`, `COGS-${receiptNumber}`, userId]
      );
      const cogsEntry = cogsEntryResult.rows[0];

      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
        [cogsEntry.id, cogsAccount.rows[0].id, totalCOGS]
      );
      await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [totalCOGS, cogsAccount.rows[0].id]
      );

      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
        [cogsEntry.id, inventoryAccount.rows[0].id, totalCOGS]
      );
      await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
        [totalCOGS, inventoryAccount.rows[0].id]
      );
    }

    // Update session totals
    await client.query(
      `UPDATE pos_sessions
       SET total_sales = total_sales + $1, total_transactions = total_transactions + 1
       WHERE id = $2`,
      [totalAmount, session_id]
    );

    await client.query('COMMIT');

    // Fetch complete sale with items for receipt
    const completeSale = await pool.query(
      `SELECT ps.*, json_agg(json_build_object(
        'product_name', psi.product_name,
        'sku', psi.sku,
        'quantity', psi.quantity,
        'unit_price', psi.unit_price,
        'discount', psi.discount,
        'total', psi.total
      )) as items
       FROM pos_sales ps
       LEFT JOIN pos_sale_items psi ON ps.id = psi.sale_id
       WHERE ps.id = $1
       GROUP BY ps.id`,
      [sale.id]
    );

    res.status(201).json(completeSale.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getSales = async (req, res) => {
  const { tenantId } = req.user;
  const { session_id } = req.query;

  try {
    let query = `
      SELECT ps.*, json_agg(json_build_object(
        'product_name', psi.product_name,
        'sku', psi.sku,
        'quantity', psi.quantity,
        'unit_price', psi.unit_price,
        'total', psi.total
      )) as items
      FROM pos_sales ps
      LEFT JOIN pos_sale_items psi ON ps.id = psi.sale_id
      WHERE ps.tenant_id = $1
    `;
    const params = [tenantId];

    if (session_id) {
      query += ` AND ps.session_id = $2`;
      params.push(session_id);
    }

    query += ` GROUP BY ps.id ORDER BY ps.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getSale = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT ps.*, json_agg(json_build_object(
        'product_name', psi.product_name,
        'sku', psi.sku,
        'quantity', psi.quantity,
        'unit_price', psi.unit_price,
        'cost_price', psi.cost_price,
        'discount', psi.discount,
        'total', psi.total
      )) as items
       FROM pos_sales ps
       LEFT JOIN pos_sale_items psi ON ps.id = psi.sale_id
       WHERE ps.id = $1 AND ps.tenant_id = $2
       GROUP BY ps.id`,
      [id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sale not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── POS SUMMARY ─────────────────────────────────────────

export const getPOSSummary = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const today = await pool.query(
      `SELECT
        COUNT(*) as total_sales,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'mpesa' THEN total_amount ELSE 0 END), 0) as mpesa_sales
       FROM pos_sales
       WHERE tenant_id = $1
       AND DATE(created_at) = CURRENT_DATE
       AND status = 'completed'`,
      [tenantId]
    );

    const activeSession = await pool.query(
      `SELECT * FROM pos_sessions WHERE tenant_id = $1 AND status = 'open' LIMIT 1`,
      [tenantId]
    );

    res.json({
      today: today.rows[0],
      active_session: activeSession.rows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};