import express from 'express';
import {
  createCustomer,
  getCustomers,
  createInvoice,
  getInvoices,
  getInvoice,
  recordPayment,
  getPayments,
  getARSummary,
} from './receivables.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Customers
router.post('/customers', createCustomer);
router.get('/customers', getCustomers);

// Invoices
router.post('/invoices', createInvoice);
router.get('/invoices', getInvoices);
router.get('/invoices/:id', getInvoice);

// Payments
router.post('/payments', recordPayment);
router.get('/payments', getPayments);

// Summary
router.get('/summary', getARSummary);

export default router;