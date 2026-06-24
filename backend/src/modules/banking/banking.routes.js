import express from 'express';
import {
  createBankAccount,
  getBankAccounts,
  createTransaction,
  getTransactions,
  reconcileTransaction,
  createMpesaTransaction,
  getMpesaTransactions,
  getBankingSummary,
} from './banking.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Bank Accounts
router.post('/accounts', createBankAccount);
router.get('/accounts', getBankAccounts);

// Transactions
router.post('/transactions', createTransaction);
router.get('/transactions', getTransactions);
router.put('/transactions/:id/reconcile', reconcileTransaction);

// M-Pesa
router.post('/mpesa', createMpesaTransaction);
router.get('/mpesa', getMpesaTransactions);

// Summary
router.get('/summary', getBankingSummary);

export default router;
