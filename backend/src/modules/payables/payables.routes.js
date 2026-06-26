import express from 'express';
import {
  createSupplier, getSuppliers, updateSupplier, deleteSupplier,
  createBill, getBills, getBill, updateBill, deleteBill,
  recordBillPayment, getBillPayments, deleteBillPayment,
  getAPSummary,
} from './payables.controller.js';
import { protect, requireAdmin } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Suppliers — master data, admin only for mutations
router.post('/suppliers', createSupplier);
router.get('/suppliers', getSuppliers);
router.put('/suppliers/:id', requireAdmin, updateSupplier);
router.delete('/suppliers/:id', requireAdmin, deleteSupplier);

// Bills — use credit notes for corrections; admin-only for emergency cleanup
router.post('/bills', createBill);
router.get('/bills', getBills);
router.get('/bills/:id', getBill);
router.put('/bills/:id', requireAdmin, updateBill);
router.delete('/bills/:id', requireAdmin, deleteBill);

// Payments — use credit notes for reversals; admin-only for emergency
router.post('/payments', recordBillPayment);
router.get('/payments', getBillPayments);
router.delete('/payments/:id', requireAdmin, deleteBillPayment);

router.get('/summary', getAPSummary);

export default router;
