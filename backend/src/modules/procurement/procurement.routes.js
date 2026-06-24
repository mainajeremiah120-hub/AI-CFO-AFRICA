import express from 'express';
import {
  createVendor,
  getVendors,
  createRequisition,
  getRequisitions,
  updateRequisitionStatus,
  createPurchaseOrder,
  getPurchaseOrders,
  receiveGoods,
  getGoodsReceived,
  createVendorInvoice,
  getVendorInvoices,
  getProcurementSummary,
} from './procurement.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Vendors
router.post('/vendors', createVendor);
router.get('/vendors', getVendors);

// Requisitions
router.post('/requisitions', createRequisition);
router.get('/requisitions', getRequisitions);
router.patch('/requisitions/:id/status', updateRequisitionStatus);

// Purchase Orders
router.post('/purchase-orders', createPurchaseOrder);
router.get('/purchase-orders', getPurchaseOrders);

// Goods Received
router.post('/goods-received', receiveGoods);
router.get('/goods-received', getGoodsReceived);

// Vendor Invoices
router.post('/vendor-invoices', createVendorInvoice);
router.get('/vendor-invoices', getVendorInvoices);

// Summary
router.get('/summary', getProcurementSummary);

export default router;
