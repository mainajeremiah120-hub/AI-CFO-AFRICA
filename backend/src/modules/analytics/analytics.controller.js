import pool from '../../config/db.js';

// ─── REVENUE VS EXPENSES ─────────────────────────────────

export const getRevenueVsExpenses = async (req, res) => {
  const { tenantId } = req.user;
  const { year } = req.query;
  const selectedYear = year || new Date().getFullYear();

  try {
    const revenue = await pool.query(
      `SELECT
        EXTRACT(MONTH FROM date) as month,
        SUM(total_amount) as total
       FROM invoices
       WHERE tenant_id = $1
       AND EXTRACT(YEAR FROM date) = $2
       GROUP BY EXTRACT(MONTH FROM date)
       ORDER BY month ASC`,
      [tenantId, selectedYear]
    );

    const expenses = await pool.query(
      `SELECT
        EXTRACT(MONTH FROM date) as month,
        SUM(total_amount) as total
       FROM bills
       WHERE tenant_id = $1
       AND EXTRACT(YEAR FROM date) = $2
       GROUP BY EXTRACT(MONTH FROM date)
       ORDER BY month ASC`,
      [tenantId, selectedYear]
    );

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const data = months.map((month, index) => {
      const monthNum = index + 1;
      const rev = revenue.rows.find(r => Number(r.month) === monthNum);
      const exp = expenses.rows.find(e => Number(e.month) === monthNum);
      return {
        month,
        revenue: Number(rev?.total || 0),
        expenses: Number(exp?.total || 0),
        profit: Number(rev?.total || 0) - Number(exp?.total || 0),
      };
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── PROFIT & LOSS ───────────────────────────────────────

export const getProfitAndLoss = async (req, res) => {
  const { tenantId } = req.user;
  const { start_date, end_date } = req.query;

  const startDate = start_date || `${new Date().getFullYear()}-01-01`;
  const endDate = end_date || new Date().toISOString().split('T')[0];

  try {
    const revenue = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM invoices
       WHERE tenant_id = $1 AND date BETWEEN $2 AND $3`,
      [tenantId, startDate, endDate]
    );

    const cogs = await pool.query(
      `SELECT COALESCE(SUM(balance), 0) as total
       FROM accounts
       WHERE tenant_id = $1 AND code = '5003'`,
      [tenantId]
    );

    const expenses = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM bills
       WHERE tenant_id = $1 AND date BETWEEN $2 AND $3`,
      [tenantId, startDate, endDate]
    );

    const payroll = await pool.query(
      `SELECT COALESCE(SUM(total_gross), 0) as total
       FROM payroll_runs
       WHERE tenant_id = $1 AND status = 'processed'`,
      [tenantId]
    );

    const totalRevenue = Number(revenue.rows[0].total);
    const totalCOGS = Number(cogs.rows[0].total);
    const grossProfit = totalRevenue - totalCOGS;
    const totalExpenses = Number(expenses.rows[0].total) + Number(payroll.rows[0].total);
    const netProfit = grossProfit - totalExpenses;

    res.json({
      period: { start_date: startDate, end_date: endDate },
      revenue: totalRevenue,
      cogs: totalCOGS,
      gross_profit: grossProfit,
      gross_margin: totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0,
      operating_expenses: totalExpenses,
      payroll_costs: Number(payroll.rows[0].total),
      net_profit: netProfit,
      net_margin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── CASH FLOW ───────────────────────────────────────────

export const getCashFlow = async (req, res) => {
  const { tenantId } = req.user;
  const { year } = req.query;
  const selectedYear = year || new Date().getFullYear();

  try {
    const cashIn = await pool.query(
      `SELECT
        EXTRACT(MONTH FROM payment_date) as month,
        SUM(amount) as total
       FROM payments
       WHERE tenant_id = $1
       AND EXTRACT(YEAR FROM payment_date) = $2
       GROUP BY EXTRACT(MONTH FROM payment_date)
       ORDER BY month ASC`,
      [tenantId, selectedYear]
    );

    const cashOut = await pool.query(
      `SELECT
        EXTRACT(MONTH FROM payment_date) as month,
        SUM(amount) as total
       FROM bill_payments
       WHERE tenant_id = $1
       AND EXTRACT(YEAR FROM payment_date) = $2
       GROUP BY EXTRACT(MONTH FROM payment_date)
       ORDER BY month ASC`,
      [tenantId, selectedYear]
    );

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const data = months.map((month, index) => {
      const monthNum = index + 1;
      const inflow = cashIn.rows.find(r => Number(r.month) === monthNum);
      const outflow = cashOut.rows.find(r => Number(r.month) === monthNum);
      return {
        month,
        cash_in: Number(inflow?.total || 0),
        cash_out: Number(outflow?.total || 0),
        net: Number(inflow?.total || 0) - Number(outflow?.total || 0),
      };
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── RECEIVABLES AGING ───────────────────────────────────

export const getReceivablesAging = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT
        c.name as customer_name,
        i.invoice_number,
        i.date,
        i.due_date,
        i.balance_due,
        i.status,
        CURRENT_DATE - i.due_date as days_overdue
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.tenant_id = $1
       AND i.status != 'paid'
       AND i.balance_due > 0
       ORDER BY days_overdue DESC`,
      [tenantId]
    );

    const current = result.rows.filter(r => r.days_overdue <= 0);
    const days1_30 = result.rows.filter(r => r.days_overdue > 0 && r.days_overdue <= 30);
    const days31_60 = result.rows.filter(r => r.days_overdue > 30 && r.days_overdue <= 60);
    const days61_90 = result.rows.filter(r => r.days_overdue > 60 && r.days_overdue <= 90);
    const over90 = result.rows.filter(r => r.days_overdue > 90);

    res.json({
      summary: {
        current: current.reduce((s, r) => s + Number(r.balance_due), 0),
        days1_30: days1_30.reduce((s, r) => s + Number(r.balance_due), 0),
        days31_60: days31_60.reduce((s, r) => s + Number(r.balance_due), 0),
        days61_90: days61_90.reduce((s, r) => s + Number(r.balance_due), 0),
        over90: over90.reduce((s, r) => s + Number(r.balance_due), 0),
      },
      invoices: result.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── PAYABLES AGING ──────────────────────────────────────

export const getPayablesAging = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT
        s.name as supplier_name,
        b.bill_number,
        b.date,
        b.due_date,
        b.balance_due,
        b.status,
        CURRENT_DATE - b.due_date as days_overdue
       FROM bills b
       LEFT JOIN suppliers s ON b.supplier_id = s.id
       WHERE b.tenant_id = $1
       AND b.status != 'paid'
       AND b.balance_due > 0
       ORDER BY days_overdue DESC`,
      [tenantId]
    );

    const current = result.rows.filter(r => r.days_overdue <= 0);
    const days1_30 = result.rows.filter(r => r.days_overdue > 0 && r.days_overdue <= 30);
    const days31_60 = result.rows.filter(r => r.days_overdue > 30 && r.days_overdue <= 60);
    const days61_90 = result.rows.filter(r => r.days_overdue > 60 && r.days_overdue <= 90);
    const over90 = result.rows.filter(r => r.days_overdue > 90);

    res.json({
      summary: {
        current: current.reduce((s, r) => s + Number(r.balance_due), 0),
        days1_30: days1_30.reduce((s, r) => s + Number(r.balance_due), 0),
        days31_60: days31_60.reduce((s, r) => s + Number(r.balance_due), 0),
        days61_90: days61_90.reduce((s, r) => s + Number(r.balance_due), 0),
        over90: over90.reduce((s, r) => s + Number(r.balance_due), 0),
      },
      bills: result.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── INVENTORY PERFORMANCE ───────────────────────────────

export const getInventoryPerformance = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT
        p.name,
        p.sku,
        p.category,
        p.cost_price,
        p.selling_price,
        p.selling_price - p.cost_price as margin,
        CASE WHEN p.cost_price > 0
          THEN ROUND(((p.selling_price - p.cost_price) / p.cost_price * 100)::numeric, 1)
          ELSE 0 END as margin_percent,
        COALESCE(sl.quantity, 0) as stock,
        p.reorder_level,
        COALESCE(sl.quantity, 0) * p.cost_price as stock_value,
        COALESCE(out_moves.total_out, 0) as total_sold
       FROM products p
       LEFT JOIN stock_levels sl ON p.id = sl.product_id
       LEFT JOIN (
         SELECT product_id, SUM(quantity) as total_out
         FROM stock_movements
         WHERE movement_type = 'out' AND tenant_id = $1
         GROUP BY product_id
       ) out_moves ON p.id = out_moves.product_id
       WHERE p.tenant_id = $1 AND p.is_active = true
       ORDER BY total_sold DESC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── DASHBOARD KPIs ──────────────────────────────────────

export const getDashboardKPIs = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const revenue = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM invoices WHERE tenant_id = $1
       AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [tenantId]
    );

    const expenses = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM bills WHERE tenant_id = $1
       AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [tenantId]
    );

    const outstanding = await pool.query(
      `SELECT COALESCE(SUM(balance_due), 0) as total
       FROM invoices WHERE tenant_id = $1 AND status != 'paid'`,
      [tenantId]
    );

    const overdue = await pool.query(
      `SELECT COALESCE(SUM(balance_due), 0) as total
       FROM invoices WHERE tenant_id = $1
       AND status != 'paid' AND due_date < CURRENT_DATE`,
      [tenantId]
    );

    const lowStock = await pool.query(
      `SELECT COUNT(*) as total
       FROM products p
       LEFT JOIN stock_levels sl ON p.id = sl.product_id
       WHERE p.tenant_id = $1
       AND COALESCE(sl.quantity, 0) <= p.reorder_level`,
      [tenantId]
    );

    const totalEmployees = await pool.query(
      `SELECT COUNT(*) as total FROM employees WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    );

    const monthRevenue = Number(revenue.rows[0].total);
    const monthExpenses = Number(expenses.rows[0].total);

    res.json({
      month_revenue: monthRevenue,
      month_expenses: monthExpenses,
      month_profit: monthRevenue - monthExpenses,
      outstanding_receivables: Number(outstanding.rows[0].total),
      overdue_receivables: Number(overdue.rows[0].total),
      low_stock_count: Number(lowStock.rows[0].total),
      total_employees: Number(totalEmployees.rows[0].total),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};