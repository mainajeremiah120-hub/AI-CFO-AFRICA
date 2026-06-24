import express from 'express';
import {
  createWarehouse,
  getWarehouses,
  updateWarehouse,
  deleteWarehouse,
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
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
router.put('/warehouses/:id', updateWarehouse);
router.delete('/warehouses/:id', deleteWarehouse);

// Products
router.post('/products', createProduct);
router.get('/products', getProducts);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

// Stock Movements
router.post('/movements', createStockMovement);
router.get('/movements', getStockMovements);

// Summary
router.get('/summary', getInventorySummary);

export default router;