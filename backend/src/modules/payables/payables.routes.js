import express from 'express';
import {
  createSupplier,
  getSuppliers,
  updateSupplier,
  deleteSupplier,
  createBill,
  getBills,
  getBill,
  recordBillPayment,
  getBillPayments,
  getAPSummary,
} from './payables.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Suppliers
router.post('/suppliers', createSupplier);
router.get('/suppliers', getSuppliers);
router.put('/suppliers/:id', updateSupplier);
router.delete('/suppliers/:id', deleteSupplier);

// Bills
router.post('/bills', createBill);
router.get('/bills', getBills);
router.get('/bills/:id', getBill);

// Bill Payments
router.post('/payments', recordBillPayment);
router.get('/payments', getBillPayments);

// Summary
router.get('/summary', getAPSummary);

export default router;