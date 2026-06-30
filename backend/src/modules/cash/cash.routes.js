import express from 'express';
import {
  getCashSummary,
  getCashAccounts,
  getCashTransactions,
  getCashLedger,
  recordCashReceipt,
  recordCashPayment,
  replenishPettyCash,
} from './cash.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/summary',      getCashSummary);
router.get('/accounts',     getCashAccounts);
router.get('/transactions', getCashTransactions);
router.get('/ledger',       getCashLedger);
router.post('/receipt',     recordCashReceipt);
router.post('/payment',     recordCashPayment);
router.post('/replenish',   replenishPettyCash);

export default router;
