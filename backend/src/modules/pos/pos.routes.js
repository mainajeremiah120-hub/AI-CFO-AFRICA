import express from 'express';
import {
  openSession,
  closeSession,
  getSessions,
  getActiveSession,
  createSale,
  getSales,
  getSale,
  getPOSSummary,
} from './pos.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Sessions
router.post('/sessions/open', openSession);
router.put('/sessions/:id/close', closeSession);
router.get('/sessions', getSessions);
router.get('/sessions/active', getActiveSession);

// Sales
router.post('/sales', createSale);
router.get('/sales', getSales);
router.get('/sales/:id', getSale);

// Summary
router.get('/summary', getPOSSummary);

export default router;