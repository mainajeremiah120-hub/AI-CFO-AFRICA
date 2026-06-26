import express from 'express';
import {
  createWarehouse, getWarehouses, updateWarehouse, deleteWarehouse,
  createProduct, getProducts, updateProduct, deleteProduct,
  createStockMovement, getStockMovements, deleteStockMovement,
  getInventorySummary,
} from './inventory.controller.js';
import { protect, requireAdmin } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Warehouses — master data, admin only for mutations
router.post('/warehouses', createWarehouse);
router.get('/warehouses', getWarehouses);
router.put('/warehouses/:id', requireAdmin, updateWarehouse);
router.delete('/warehouses/:id', requireAdmin, deleteWarehouse);

// Products — master data, admin only for mutations
router.post('/products', createProduct);
router.get('/products', getProducts);
router.put('/products/:id', requireAdmin, updateProduct);
router.delete('/products/:id', requireAdmin, deleteProduct);

// Stock Movements — use Stock Spoilage credit note for write-offs
router.post('/movements', createStockMovement);
router.get('/movements', getStockMovements);
router.delete('/movements/:id', requireAdmin, deleteStockMovement);

router.get('/summary', getInventorySummary);

export default router;
