import express from 'express';
import {
  createBankAccount, getBankAccounts,
  createTransaction, getTransactions, reconcileTransaction, updateTransaction, deleteTransaction,
  createMpesaTransaction, getMpesaTransactions, deleteMpesaTransaction,
  getBankingSummary,
} from './banking.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post('/accounts', createBankAccount);
router.get('/accounts', getBankAccounts);

router.post('/transactions', createTransaction);
router.get('/transactions', getTransactions);
router.put('/transactions/:id', updateTransaction);
router.put('/transactions/:id/reconcile', reconcileTransaction);
router.delete('/transactions/:id', deleteTransaction);

router.post('/mpesa', createMpesaTransaction);
router.get('/mpesa', getMpesaTransactions);
router.delete('/mpesa/:id', deleteMpesaTransaction);

router.get('/summary', getBankingSummary);

export default router;
