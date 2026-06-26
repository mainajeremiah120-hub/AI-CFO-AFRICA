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

export const updateEmployee = async (req, res) => {
  const { id } = req.params;
  const { full_name, email, phone, position, department, basic_salary, bank_account } = req.body;
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `UPDATE employees SET full_name=$1, email=$2, phone=$3, position=$4, department=$5, basic_salary=$6, bank_account=$7
       WHERE id=$8 AND tenant_id=$9 RETURNING *`,
      [full_name, email, phone, position, department, basic_salary, bank_account, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteEmployee = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  try {
    await pool.query(`UPDATE employees SET is_active=false WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    res.json({ message: 'Employee deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── PAYROLL CALCULATION ─────────────────────────────────

const DEFAULT_RATES = {
  paye_rate: 0.20,
  nssf_amount: 2160,
  housing_levy_rate: 0.015,
  nhif_brackets: [
    { min_salary: 0,      max_salary: 15000,  amount: 150  },
    { min_salary: 15001,  max_salary: 30000,  amount: 500  },
    { min_salary: 30001,  max_salary: 50000,  amount: 850  },
    { min_salary: 50001,  max_salary: 100000, amount: 1200 },
    { min_salary: 100001, max_salary: null,   amount: 1700 },
  ],
};

const loadRates = async (tenantId) => {
  try {
    const res = await pool.query(
      `SELECT statutory_rates FROM company_settings WHERE tenant_id=$1`,
      [tenantId]
    );
    const stored = res.rows[0]?.statutory_rates;
    return stored ? { ...DEFAULT_RATES, ...stored } : DEFAULT_RATES;
  } catch {
    return DEFAULT_RATES;
  }
};

const computeNhif = (salary, brackets) => {
  const sorted = [...brackets].sort((a, b) => b.min_salary - a.min_salary);
  for (const b of sorted) {
    if (salary > b.min_salary) return b.amount;
  }
  return brackets[brackets.length - 1]?.amount || 150;
};

const calculateDeductions = (basic_salary, rates = DEFAULT_RATES) => {
  const salary       = Number(basic_salary);
  const paye         = Math.round(salary * Number(rates.paye_rate        || 0.20));
  const nssf         = Number(rates.nssf_amount                          || 2160);
  const nhif         = computeNhif(salary, rates.nhif_brackets || DEFAULT_RATES.nhif_brackets);
  const housing_levy = Math.round(salary * Number(rates.housing_levy_rate || 0.015));
  const total_deductions = paye + nssf + nhif + housing_levy;
  return { paye, nssf, nhif, housing_levy, total_deductions, net_pay: salary - total_deductions };
};

// ─── PAYROLL RUNS ────────────────────────────────────────

export const createPayrollRun = async (req, res) => {
  const { month, year } = req.body;
  const { tenantId, userId } = req.user;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id FROM payroll_runs WHERE tenant_id = $1 AND month = $2 AND year = $3`,
      [tenantId, month, year]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payroll already exists for this month/year' });
    }

    const employees = (await client.query(
      `SELECT * FROM employees WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    )).rows;

    if (employees.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active employees found' });
    }

    const runResult = await client.query(
      `INSERT INTO payroll_runs (tenant_id, month, year, status, created_by)
       VALUES ($1, $2, $3, 'draft', $4) RETURNING *`,
      [tenantId, month, year, userId]
    );
    const run = runResult.rows[0];

    // Read statutory rates configured in Settings (falls back to defaults)
    const rates = await loadRates(tenantId);

    let total_gross = 0, total_paye = 0, total_nssf = 0,
        total_nhif = 0, total_housing = 0, total_deductions = 0, total_net = 0;

    for (const emp of employees) {
      const d = calculateDeductions(emp.basic_salary, rates);

      // other_deductions stores the housing levy
      await client.query(
        `INSERT INTO payslips
           (tenant_id, payroll_run_id, employee_id, basic_salary,
            paye, nssf, nhif, other_deductions,
            gross_pay, total_deductions, net_pay)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$4,$9,$10)`,
        [tenantId, run.id, emp.id, emp.basic_salary,
         d.paye, d.nssf, d.nhif, d.housing_levy,
         d.total_deductions, d.net_pay]
      );

      total_gross       += Number(emp.basic_salary);
      total_paye        += d.paye;
      total_nssf        += d.nssf;
      total_nhif        += d.nhif;
      total_housing     += d.housing_levy;
      total_deductions  += d.total_deductions;
      total_net         += d.net_pay;
    }

    await client.query(
      `UPDATE payroll_runs
       SET total_gross=$1, total_deductions=$2, total_net=$3
       WHERE id=$4`,
      [total_gross, total_deductions, total_net, run.id]
    );

    await client.query('COMMIT');
    res.status(201).json({
      ...run, total_gross, total_paye, total_nssf,
      total_nhif, total_housing, total_deductions, total_net,
    });
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
      `SELECT pr.*,
              COALESCE(SUM(ps.paye),0)  AS total_paye,
              COALESCE(SUM(ps.nssf),0)  AS total_nssf,
              COALESCE(SUM(ps.nhif),0)  AS total_nhif,
              COALESCE(SUM(
                CASE WHEN ps.other_deductions = 0
                     THEN ROUND(ps.gross_pay::NUMERIC * 0.015)
                     ELSE ps.other_deductions END
              ),0)                      AS total_housing,
              COUNT(ps.id)              AS employee_count
       FROM payroll_runs pr
       LEFT JOIN payslips ps ON ps.payroll_run_id = pr.id
       WHERE pr.tenant_id = $1
       GROUP BY pr.id
       ORDER BY pr.year DESC, pr.month DESC`,
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
      `SELECT ps.*, e.full_name, e.employee_number, e.position, e.department, e.bank_account
       FROM payslips ps
       LEFT JOIN employees e ON ps.employee_id = e.id
       WHERE ps.payroll_run_id = $1 AND ps.tenant_id = $2
       ORDER BY e.full_name ASC`,
      [runId, tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── PROCESS PAYROLL (journal entry) ────────────────────

export const processPayroll = async (req, res) => {
  const { runId } = req.params;
  const { tenantId, userId } = req.user;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const run = (await client.query(
      `SELECT * FROM payroll_runs WHERE id=$1 AND tenant_id=$2`,
      [runId, tenantId]
    )).rows[0];
    if (!run) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Run not found' }); }
    if (run.status === 'processed') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Already processed' }); }

    const salaryExpense = (await client.query(`SELECT id FROM accounts WHERE tenant_id=$1 AND code='5002'`, [tenantId])).rows[0];
    const bankAccount   = (await client.query(`SELECT id FROM accounts WHERE tenant_id=$1 AND code='1002'`, [tenantId])).rows[0];
    const payable       = (await client.query(`SELECT id FROM accounts WHERE tenant_id=$1 AND code='1004'`, [tenantId])).rows[0];

    if (!salaryExpense || !bankAccount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Required accounts (5002, 1002) not found in Chart of Accounts' });
    }

    const entry = (await client.query(
      `INSERT INTO journal_entries (tenant_id, date, description, reference, created_by)
       VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
      [tenantId, `Payroll — ${run.month}/${run.year}`, `PAYROLL-${run.month}-${run.year}`, userId]
    )).rows[0];

    // Dr Salary Expense (full gross)
    await client.query(
      `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,0)`,
      [entry.id, salaryExpense.id, run.total_gross]
    );
    await client.query(`UPDATE accounts SET balance=balance+$1 WHERE id=$2`, [run.total_gross, salaryExpense.id]);

    // Cr Bank Account (net disbursement)
    await client.query(
      `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,0,$3)`,
      [entry.id, bankAccount.id, run.total_net]
    );
    await client.query(`UPDATE accounts SET balance=balance-$1 WHERE id=$2`, [run.total_net, bankAccount.id]);

    // Cr Payable (statutory deductions withheld)
    if (payable && run.total_deductions > 0) {
      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,0,$3)`,
        [entry.id, payable.id, run.total_deductions]
      );
      await client.query(`UPDATE accounts SET balance=balance-$1 WHERE id=$2`, [run.total_deductions, payable.id]);
    }

    await client.query(
      `UPDATE payroll_runs SET status='processed', processed_at=NOW() WHERE id=$1`,
      [runId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Payroll processed successfully' });
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
    const [empRes, runsRes, deductRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as total_employees, COALESCE(SUM(basic_salary),0) as total_monthly_salary
         FROM employees WHERE tenant_id=$1 AND is_active=true`,
        [tenantId]
      ),
      pool.query(
        `SELECT COUNT(*) as total_runs,
                COUNT(*) FILTER (WHERE status='processed') as processed_runs
         FROM payroll_runs WHERE tenant_id=$1`,
        [tenantId]
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(ps.paye),0)  AS ytd_paye,
           COALESCE(SUM(ps.nssf),0)  AS ytd_nssf,
           COALESCE(SUM(ps.nhif),0)  AS ytd_nhif,
           COALESCE(SUM(
             CASE WHEN ps.other_deductions = 0
                  THEN ROUND(ps.gross_pay::NUMERIC * 0.015)
                  ELSE ps.other_deductions END
           ),0)                      AS ytd_housing,
           COALESCE(SUM(ps.net_pay - CASE WHEN ps.other_deductions = 0
                  THEN ROUND(ps.gross_pay::NUMERIC * 0.015) ELSE 0 END),0) AS ytd_net,
           COALESCE(SUM(ps.gross_pay),0) AS ytd_gross
         FROM payslips ps
         JOIN payroll_runs pr ON ps.payroll_run_id = pr.id
         WHERE ps.tenant_id=$1 AND pr.status='processed'
           AND pr.year=EXTRACT(YEAR FROM CURRENT_DATE)`,
        [tenantId]
      ),
    ]);

    const lastRun = (await pool.query(
      `SELECT pr.*,
              COALESCE(SUM(ps.paye),0)  AS total_paye,
              COALESCE(SUM(ps.nssf),0)  AS total_nssf,
              COALESCE(SUM(ps.nhif),0)  AS total_nhif,
              COALESCE(SUM(
                CASE WHEN ps.other_deductions = 0
                     THEN ROUND(ps.gross_pay::NUMERIC * 0.015)
                     ELSE ps.other_deductions END
              ),0)                      AS total_housing
       FROM payroll_runs pr
       LEFT JOIN payslips ps ON ps.payroll_run_id=pr.id
       WHERE pr.tenant_id=$1
       GROUP BY pr.id
       ORDER BY pr.year DESC, pr.month DESC LIMIT 1`,
      [tenantId]
    )).rows[0] || null;

    res.json({
      ...empRes.rows[0],
      ...runsRes.rows[0],
      ...deductRes.rows[0],
      last_run: lastRun,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── DELETE ──────────────────────────────────────────────

export const deletePayrollRun = async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const run = (await client.query(`SELECT id FROM payroll_runs WHERE id=$1 AND tenant_id=$2`, [id, tenantId])).rows[0];
    if (!run) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Run not found' }); }
    await client.query(`DELETE FROM payslips WHERE payroll_run_id=$1`, [id]);
    await client.query(`DELETE FROM payroll_runs WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    await client.query('COMMIT');
    res.json({ message: 'Payroll run deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
