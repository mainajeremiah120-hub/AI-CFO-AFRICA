import express from 'express';
import {
  createBankAccount, getBankAccounts, updateBankAccount, deleteBankAccount,
  createTransaction, getTransactions, reconcileTransaction, updateTransaction, deleteTransaction,
  createMpesaTransaction, getMpesaTransactions, deleteMpesaTransaction,
  getBankingSummary,
} from './banking.controller.js';
import { protect, requireAdmin } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Bank accounts — master data, admin only for mutations
router.post('/accounts', createBankAccount);
router.get('/accounts', getBankAccounts);
router.put('/accounts/:id', requireAdmin, updateBankAccount);
router.delete('/accounts/:id', requireAdmin, deleteBankAccount);

// Transactions — record only; reversals via credit notes
router.post('/transactions', createTransaction);
router.get('/transactions', getTransactions);
router.put('/transactions/:id', requireAdmin, updateTransaction);
router.put('/transactions/:id/reconcile', reconcileTransaction);
router.delete('/transactions/:id', requireAdmin, deleteTransaction);

// M-Pesa — record only
router.post('/mpesa', createMpesaTransaction);
router.get('/mpesa', getMpesaTransactions);
router.delete('/mpesa/:id', requireAdmin, deleteMpesaTransaction);

router.get('/summary', getBankingSummary);

export default router;
