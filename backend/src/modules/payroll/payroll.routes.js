import express from 'express';
import {
  createEmployee,
  getEmployees,
  createPayrollRun,
  getPayrollRuns,
  getPayslips,
  processPayroll,
  getPayrollSummary,
} from './payroll.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Employees
router.post('/employees', createEmployee);
router.get('/employees', getEmployees);

// Payroll Runs
router.post('/runs', createPayrollRun);
router.get('/runs', getPayrollRuns);
router.get('/runs/:runId/payslips', getPayslips);
router.post('/runs/:runId/process', processPayroll);

// Summary
router.get('/summary', getPayrollSummary);

export default router;