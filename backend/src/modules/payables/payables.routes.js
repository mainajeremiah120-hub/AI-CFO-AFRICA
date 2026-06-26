import express from 'express';
import {
  createSupplier, getSuppliers, updateSupplier, deleteSupplier,
  createBill, getBills, getBill, updateBill, deleteBill,
  recordBillPayment, getBillPayments, deleteBillPayment,
  getAPSummary,
} from './payables.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post('/suppliers', createSupplier);
router.get('/suppliers', getSuppliers);
router.put('/suppliers/:id', updateSupplier);
router.delete('/suppliers/:id', deleteSupplier);

router.post('/bills', createBill);
router.get('/bills', getBills);
router.get('/bills/:id', getBill);
router.put('/bills/:id', updateBill);
router.delete('/bills/:id', deleteBill);

router.post('/payments', recordBillPayment);
router.get('/payments', getBillPayments);
router.delete('/payments/:id', deleteBillPayment);

router.get('/summary', getAPSummary);

export default router;
