import express from 'express';
import {
  getSettings,
  updateCompany,
  updateSettings,
  getProfile,
  updateProfile,
  changePassword,
  getUsers,
  createUser,
  updateUserRole,
  deleteUser,
  resetTransactionData,
  seedDefaultAccounts,
  getStatutoryRates,
  updateStatutoryRates,
} from './settings.controller.js';
import { protect, requireAdmin } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Company settings — admin only
router.get('/', getSettings);
router.put('/company',  requireAdmin, updateCompany);
router.put('/update',   requireAdmin, updateSettings);

// Profile — any authenticated user
router.get('/profile',  getProfile);
router.put('/profile',  updateProfile);
router.put('/password', changePassword);

// User management — admin only
router.get('/users',         requireAdmin, getUsers);
router.post('/users',        requireAdmin, createUser);
router.put('/users/:id',     requireAdmin, updateUserRole);
router.delete('/users/:id',  requireAdmin, deleteUser);

// Data reset — admin only (DANGEROUS)
router.post('/reset', requireAdmin, resetTransactionData);

// Seed accounts — admin only
router.post('/seed-accounts', requireAdmin, seedDefaultAccounts);

// Statutory payroll rates — admin only
router.get('/statutory-rates',  getStatutoryRates);
router.put('/statutory-rates',  requireAdmin, updateStatutoryRates);

export default router;
