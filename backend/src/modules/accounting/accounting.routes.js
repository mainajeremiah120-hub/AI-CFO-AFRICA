import express from 'express';
import {
  createAccount,
  getAccounts,
  updateAccount,
  createJournalEntry,
  getJournalEntries,
  getTrialBalance,
  createFiscalYear,
  getFiscalYears,
} from './accounting.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Accounts
router.post('/accounts', createAccount);
router.get('/accounts', getAccounts);
router.put('/accounts/:id', updateAccount);

// Journal Entries
router.post('/journal-entries', createJournalEntry);
router.get('/journal-entries', getJournalEntries);

// Trial Balance
router.get('/trial-balance', getTrialBalance);

// Fiscal Years
router.post('/fiscal-years', createFiscalYear);
router.get('/fiscal-years', getFiscalYears);

export default router;