import express from 'express';
import {
  getRevenueVsExpenses,
  getProfitAndLoss,
  getCashFlow,
  getReceivablesAging,
  getPayablesAging,
  getInventoryPerformance,
  getDashboardKPIs,
} from './analytics.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/revenue-vs-expenses', getRevenueVsExpenses);
router.get('/profit-and-loss', getProfitAndLoss);
router.get('/cash-flow', getCashFlow);
router.get('/receivables-aging', getReceivablesAging);
router.get('/payables-aging', getPayablesAging);
router.get('/inventory-performance', getInventoryPerformance);
router.get('/dashboard-kpis', getDashboardKPIs);

export default router;