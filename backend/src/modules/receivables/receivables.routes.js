import express from 'express';
import {
  createCustomer, getCustomers, updateCustomer, deleteCustomer,
  createInvoice, getInvoices, getInvoice, updateInvoice, deleteInvoice,
  recordPayment, getPayments, deletePayment,
  getARSummary,
} from './receivables.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post('/customers', createCustomer);
router.get('/customers', getCustomers);
router.put('/customers/:id', updateCustomer);
router.delete('/customers/:id', deleteCustomer);

router.post('/invoices', createInvoice);
router.get('/invoices', getInvoices);
router.get('/invoices/:id', getInvoice);
router.put('/invoices/:id', updateInvoice);
router.delete('/invoices/:id', deleteInvoice);

router.post('/payments', recordPayment);
router.get('/payments', getPayments);
router.delete('/payments/:id', deletePayment);

router.get('/summary', getARSummary);

export default router;
