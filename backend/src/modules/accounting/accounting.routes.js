import express from 'express';
import {
  createAccount, getAccounts, updateAccount, deleteAccount,
  createJournalEntry, getJournalEntries, updateJournalEntry, deleteJournalEntry,
  getTrialBalance,
  createFiscalYear, getFiscalYears,
} from './accounting.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post('/accounts', createAccount);
router.get('/accounts', getAccounts);
router.put('/accounts/:id', updateAccount);
router.delete('/accounts/:id', deleteAccount);

router.post('/journal-entries', createJournalEntry);
router.get('/journal-entries', getJournalEntries);
router.put('/journal-entries/:id', updateJournalEntry);
router.delete('/journal-entries/:id', deleteJournalEntry);

router.get('/trial-balance', getTrialBalance);

router.post('/fiscal-years', createFiscalYear);
router.get('/fiscal-years', getFiscalYears);

export default router;
