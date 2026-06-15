import pool from '../../config/db.js';

// ─── EMPLOYEES ───────────────────────────────────────────

export const createEmployee = async (req, res) => {
  const { employee_number, full_name, email, phone, position, department, basic_salary, bank_account, hire_date } = req.body;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `INSERT INTO employees (tenant_id, employee_number, full_name, email, phone, position, department, basic_salary, bank_account, hire_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [tenantId, employee_number, full_name, email, phone, position, department, basic_salary, bank_account, hire_date || new Date()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getEmployees = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT * FROM employees WHERE tenant_id = $1 AND is_active = true ORDER BY full_name ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── PAYROLL CALCULATION HELPER ──────────────────────────

const calculateDeductions = (basic_salary) => {
  const salary = Number(basic_salary);
  const paye = salary * 0.20;
  const nssf = 2160;
  const nhif = salary > 100000 ? 1700 : salary > 50000 ? 1200 : 850;
  const total_deductions = paye + nssf + nhif;
  const net_pay = salary - total_deductions;

  return { paye, nssf, nhif, total_deductions, net_pay };
};

// ─── PAYROLL RUNS ────────────────────────────────────────

export const createPayrollRun = async (req, res) => {
  const { month, year } = req.body;
  const { tenantId, userId } = req.user;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if run already exists for this month/year
    const existing = await client.query(
      `SELECT * FROM payroll_runs WHERE tenant_id = $1 AND month = $2 AND year = $3`,
      [tenantId, month, year]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payroll already exists for this month' });
    }

    const employeesResult = await client.query(
      `SELECT * FROM employees WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    );
    const employees = employeesResult.rows;

    if (employees.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active employees found' });
    }

    let total_gross = 0;
    let total_deductions = 0;
    let total_net = 0;

    const runResult = await client.query(
      `INSERT INTO payroll_runs (tenant_id, month, year, status, created_by)
       VALUES ($1, $2, $3, 'draft', $4) RETURNING *`,
      [tenantId, month, year, userId]
    );
    const run = runResult.rows[0];

    for (const emp of employees) {
      const { paye, nssf, nhif, total_deductions: empDeductions, net_pay } = calculateDeductions(emp.basic_salary);

      await client.query(
        `INSERT INTO payslips (tenant_id, payroll_run_id, employee_id, basic_salary, paye, nssf, nhif, other_deductions, gross_pay, total_deductions, net_pay)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $4, $8, $9)`,
        [tenantId, run.id, emp.id, emp.basic_salary, paye, nssf, nhif, empDeductions, net_pay]
      );

      total_gross += Number(emp.basic_salary);
      total_deductions += empDeductions;
      total_net += net_pay;
    }

    await client.query(
      `UPDATE payroll_runs SET total_gross = $1, total_deductions = $2, total_net = $3 WHERE id = $4`,
      [total_gross, total_deductions, total_net, run.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...run, total_gross, total_deductions, total_net });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getPayrollRuns = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT * FROM payroll_runs WHERE tenant_id = $1 ORDER BY year DESC, month DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPayslips = async (req, res) => {
  const { runId } = req.params;
  const { tenantId } = req.user;

  try {
    const result = await pool.query(
      `SELECT p.*, e.full_name, e.employee_number, e.position
       FROM payslips p
       LEFT JOIN employees e ON p.employee_id = e.id
       WHERE p.payroll_run_id = $1 AND p.tenant_id = $2
       ORDER BY e.full_name ASC`,
      [runId, tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── PROCESS PAYROLL (post journal entry) ───────────────

export const processPayroll = async (req, res) => {
  const { runId } = req.params;
  const { tenantId, userId } = req.user;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const runResult = await client.query(
      `SELECT * FROM payroll_runs WHERE id = $1 AND tenant_id = $2`,
      [runId, tenantId]
    );
    const run = runResult.rows[0];
    if (!run) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payroll run not found' });
    }
    if (run.status === 'processed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payroll already processed' });
    }

    // Get account IDs
    const salaryExpense = await client.query(`SELECT id FROM accounts WHERE tenant_id = $1 AND code = '5002'`, [tenantId]);
    const bankAccount = await client.query(`SELECT id FROM accounts WHERE tenant_id = $1 AND code = '1002'`, [tenantId]);
    const payableAccount = await client.query(`SELECT id FROM accounts WHERE tenant_id = $1 AND code = '1004'`, [tenantId]);

    if (!salaryExpense.rows[0] || !bankAccount.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Required accounts (5002 Salary Expense, 1002 Bank Account) not found' });
    }

    const salaryExpenseId = salaryExpense.rows[0].id;
    const bankAccountId = bankAccount.rows[0].id;
    const payableAccountId = payableAccount.rows[0]?.id;

    const entryResult = await client.query(
      `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
       VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
      [tenantId, `Payroll — ${run.month}/${run.year}`, `PAYROLL-${run.month}-${run.year}`, userId]
    );
    const entry = entryResult.rows[0];

    // Debit Salary Expense (gross)
    await client.query(
      `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`,
      [entry.id, salaryExpenseId, run.total_gross]
    );
    await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [run.total_gross, salaryExpenseId]);

    // Credit Bank Account (net pay)
    await client.query(
      `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
      [entry.id, bankAccountId, run.total_net]
    );
    await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [run.total_net, bankAccountId]);

    // Credit Payable Account (statutory deductions owed)
    if (payableAccountId && run.total_deductions > 0) {
      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`,
        [entry.id, payableAccountId, run.total_deductions]
      );
      await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [run.total_deductions, payableAccountId]);
    }

    await client.query(
      `UPDATE payroll_runs SET status = 'processed', processed_at = NOW() WHERE id = $1`,
      [runId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Payroll processed successfully', run: { ...run, status: 'processed' } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ─── SUMMARY ─────────────────────────────────────────────

export const getPayrollSummary = async (req, res) => {
  const { tenantId } = req.user;

  try {
    const employeeCount = await pool.query(
      `SELECT COUNT(*) as total_employees, COALESCE(SUM(basic_salary), 0) as total_monthly_salary
       FROM employees WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    );

    const lastRun = await pool.query(
      `SELECT * FROM payroll_runs WHERE tenant_id = $1 ORDER BY year DESC, month DESC LIMIT 1`,
      [tenantId]
    );

    res.json({
      ...employeeCount.rows[0],
      last_run: lastRun.rows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};