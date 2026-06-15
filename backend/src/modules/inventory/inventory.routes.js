import express from 'express';
import {
  createWarehouse,
  getWarehouses,
  createProduct,
  getProducts,
  createStockMovement,
  getStockMovements,
  getInventorySummary,
} from './inventory.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Warehouses
router.post('/warehouses', createWarehouse);
router.get('/warehouses', getWarehouses);

// Products
router.post('/products', createProduct);
router.get('/products', getProducts);

// Stock Movements
router.post('/movements', createStockMovement);
router.get('/movements', getStockMovements);

// Summary
router.get('/summary', getInventorySummary);

export default router;