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
} from './settings.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Company
router.get('/', getSettings);
router.put('/company', updateCompany);
router.put('/update', updateSettings);

// Profile
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/password', changePassword);

// Users
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUserRole);
router.delete('/users/:id', deleteUser);

// Data Reset
router.post('/reset', resetTransactionData);

export default router;