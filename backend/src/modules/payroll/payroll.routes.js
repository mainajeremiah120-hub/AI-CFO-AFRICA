import express from 'express';
import {
  createEmployee, getEmployees, updateEmployee, deleteEmployee,
  createPayrollRun, getPayrollRuns, getPayslips, processPayroll, deletePayrollRun,
  getPayrollSummary,
} from './payroll.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post('/employees', createEmployee);
router.get('/employees', getEmployees);
router.put('/employees/:id', updateEmployee);
router.delete('/employees/:id', deleteEmployee);

router.post('/runs', createPayrollRun);
router.get('/runs', getPayrollRuns);
router.get('/runs/:runId/payslips', getPayslips);
router.post('/runs/:runId/process', processPayroll);
router.delete('/runs/:id', deletePayrollRun);

router.get('/summary', getPayrollSummary);

export default router;
