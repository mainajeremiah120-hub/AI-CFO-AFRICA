import express from 'express';
import {
  createCustomer, getCustomers, updateCustomer, deleteCustomer,
  createInvoice, getInvoices, getInvoice, updateInvoice, deleteInvoice,
  recordPayment, getPayments, deletePayment,
  getARSummary,
} from './receivables.controller.js';
import { protect, requireAdmin } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Customers — master data, admin only for mutations
router.post('/customers', createCustomer);
router.get('/customers', getCustomers);
router.put('/customers/:id', requireAdmin, updateCustomer);
router.delete('/customers/:id', requireAdmin, deleteCustomer);

// Invoices — use credit notes for corrections; admin-only for emergency cleanup
router.post('/invoices', createInvoice);
router.get('/invoices', getInvoices);
router.get('/invoices/:id', getInvoice);
router.put('/invoices/:id', requireAdmin, updateInvoice);
router.delete('/invoices/:id', requireAdmin, deleteInvoice);

// Payments — use credit notes for reversals; admin-only for emergency
router.post('/payments', recordPayment);
router.get('/payments', getPayments);
router.delete('/payments/:id', requireAdmin, deletePayment);

router.get('/summary', getARSummary);

export default router;
