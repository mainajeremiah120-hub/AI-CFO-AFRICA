import express from 'express';
import {
  createAccount, getAccounts, updateAccount, deleteAccount,
  createJournalEntry, getJournalEntries, updateJournalEntry, deleteJournalEntry,
  getTrialBalance,
  createFiscalYear, getFiscalYears,
  getLockedPeriods, lockPeriod, unlockPeriod,
} from './accounting.controller.js';
import { protect, requireAdmin } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Chart of Accounts — reads open, mutations admin-only
router.get('/accounts',       getAccounts);
router.post('/accounts',      requireAdmin, createAccount);
router.put('/accounts/:id',   requireAdmin, updateAccount);
router.delete('/accounts/:id',requireAdmin, deleteAccount);

// Journal Entries — reads open, mutations admin-only (use module workflows instead)
router.get('/journal-entries',      getJournalEntries);
router.post('/journal-entries',     requireAdmin, createJournalEntry);
router.put('/journal-entries/:id',  requireAdmin, updateJournalEntry);
router.delete('/journal-entries/:id', requireAdmin, deleteJournalEntry);

router.get('/trial-balance', getTrialBalance);

router.post('/fiscal-years', requireAdmin, createFiscalYear);
router.get('/fiscal-years',  getFiscalYears);

// Locked Periods
router.get('/locked-periods',        getLockedPeriods);
router.post('/locked-periods',       requireAdmin, lockPeriod);
router.delete('/locked-periods/:id', requireAdmin, unlockPeriod);

export default router;
