import pool from '../../config/db.js';

// ─── WAREHOUSES ──────────────────────────────────────────

export const createWarehouse = async (req, res) => {
  const { name, location } = req.body;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `INSERT INTO warehouses (tenant_id, name, location) VALUES ($1, $2, $3) RETURNING *`,
      [tenantId, name, location]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getWarehouses = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT * FROM warehouses WHERE tenant_id = $1 AND is_active = true ORDER BY name ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── PRODUCTS ────────────────────────────────────────────

export const createProduct = async (req, res) => {
  const { sku, name, description, category, unit, cost_price, selling_price, reorder_level } = req.body;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `INSERT INTO products (tenant_id, sku, name, description, category, unit, cost_price, selling_price, reorder_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [tenantId, sku, name, description, category, unit || 'pcs', cost_price || 0, selling_price || 0, reorder_level || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getProducts = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT p.*,
        COALESCE(SUM(sl.quantity), 0) as total_stock
       FROM products p
       LEFT JOIN stock_levels sl ON p.id = sl.product_id
       WHERE p.tenant_id = $1 AND p.is_active = true
       GROUP BY p.id
       ORDER BY p.name ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── STOCK MOVEMENTS ─────────────────────────────────────

export const createStockMovement = async (req, res) => {
  const { product_id, warehouse_id, movement_type, quantity, reason, reference } = req.body;
  const { tenantId, userId } = req.user;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const productResult = await client.query(
      `SELECT cost_price, name FROM products WHERE id = $1 AND tenant_id = $2`,
      [product_id, tenantId]
    );
    const product = productResult.rows[0];
    if (!product) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const existing = await client.query(
      `SELECT * FROM stock_levels WHERE product_id = $1 AND warehouse_id = $2`,
      [product_id, warehouse_id]
    );

    let currentQty = existing.rows[0]?.quantity || 0;
    const change = movement_type === 'in' ? Number(quantity) : -Number(quantity);
    const newQty = Number(currentQty) + change;

    if (newQty < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient stock for this movement' });
    }

    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE stock_levels SET quantity = $1 WHERE product_id = $2 AND warehouse_id = $3`,
        [newQty, product_id, warehouse_id]
      );
    } else {
      await client.query(
        `INSERT INTO stock_levels (tenant_id, product_id, warehouse_id, quantity) VALUES ($1, $2, $3, $4)`,
        [tenantId, product_id, warehouse_id, newQty]
      );
    }

    const movementResult = await client.query(
      `INSERT INTO stock_movements (tenant_id, product_id, warehouse_id, movement_type, quantity, reason, reference, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [tenantId, product_id, warehouse_id, movement_type, quantity, reason, reference, userId]
    );

    // ─── AUTO-POST JOURNAL ENTRY ───────────────────────────
    const stockValue = Number(quantity) * Number(product.cost_price);

    if (stockValue > 0) {
      const inventoryAccount = await client.query(
        `SELECT id FROM accounts WHERE tenant_id = $1 AND code = '1005'`,
        [tenantId]
      );

      const counterAccountCode = movement_type === 'in' ? '1002' : '5003';
      const counterAccount = await client.query(
        `SELECT id FROM accounts WHERE tenant_id = $1 AND code = $2`,
        [tenantId, counterAccountCode]
      );

      if (inventoryAccount.rows[0] && counterAccount.rows[0]) {
        const inventoryAccountId = inventoryAccount.rows[0].id;
        const counterAccountId = counterAccount.rows[0].id;

        const entryResult = await client.query(
          `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
           VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
          [
            tenantId,
            movement_type === 'in'
              ? `Stock received — ${product.name}`
              : `Stock issued — ${product.name}`,
            reference || `STK-${Date.now()}`,
            userId
          ]
        );
        const entry = entryResult.rows[0];

        if (movement_type === 'in') {
          await client.query(
            `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
            [entry.id, inventoryAccountId, stockValue]
          );
          await client.query(
            `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
            [entry.id, counterAccountId, stockValue]
          );
          await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [stockValue, inventoryAccountId]);
          await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [stockValue, counterAccountId]);
        } else {
          await client.query(
            `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
            [entry.id, counterAccountId, stockValue]
          );
          await client.query(
            `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
            [entry.id, inventoryAccountId, stockValue]
          );
          await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [stockValue, counterAccountId]);
          await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [stockValue, inventoryAccountId]);
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json(movementResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getStockMovements = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT sm.*, p.name as product_name, p.sku, w.name as warehouse_name
       FROM stock_movements sm
       LEFT JOIN products p ON sm.product_id = p.id
       LEFT JOIN warehouses w ON sm.warehouse_id = w.id
       WHERE sm.tenant_id = $1
       ORDER BY sm.created_at DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── INVENTORY SUMMARY ───────────────────────────────────

export const getInventorySummary = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT
        COUNT(DISTINCT p.id) as total_products,
        COALESCE(SUM(sl.quantity * p.cost_price), 0) as total_stock_value,
        COUNT(DISTINCT CASE WHEN sl.quantity <= p.reorder_level THEN p.id END) as low_stock_count,
        COUNT(DISTINCT CASE WHEN sl.quantity = 0 THEN p.id END) as out_of_stock_count
       FROM products p
       LEFT JOIN stock_levels sl ON p.id = sl.product_id
       WHERE p.tenant_id = $1 AND p.is_active = true`,
      [tenantId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};