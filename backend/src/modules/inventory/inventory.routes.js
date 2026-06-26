import express from 'express';
import {
  createWarehouse, getWarehouses, updateWarehouse, deleteWarehouse,
  createProduct, getProducts, updateProduct, deleteProduct,
  createStockMovement, getStockMovements, deleteStockMovement,
  getInventorySummary,
} from './inventory.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post('/warehouses', createWarehouse);
router.get('/warehouses', getWarehouses);
router.put('/warehouses/:id', updateWarehouse);
router.delete('/warehouses/:id', deleteWarehouse);

router.post('/products', createProduct);
router.get('/products', getProducts);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

router.post('/movements', createStockMovement);
router.get('/movements', getStockMovements);
router.delete('/movements/:id', deleteStockMovement);

router.get('/summary', getInventorySummary);

export default router;
