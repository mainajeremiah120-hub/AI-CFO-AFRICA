import express from 'express';
import {
  createVendor, getVendors, updateVendor, deleteVendor,
  createRequisition, getRequisitions, updateRequisitionStatus, deleteRequisition,
  createPurchaseOrder, getPurchaseOrders, updatePurchaseOrder, deletePurchaseOrder,
  receiveGoods, getGoodsReceived, deleteGoodsReceived,
  createVendorInvoice, getVendorInvoices, deleteVendorInvoice,
  getProcurementSummary,
} from './procurement.controller.js';
import { protect, requireAdmin } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Vendors — master data, admin only for mutations
router.post('/vendors', createVendor);
router.get('/vendors', getVendors);
router.put('/vendors/:id', requireAdmin, updateVendor);
router.delete('/vendors/:id', requireAdmin, deleteVendor);

// Requisitions — internal document, admin only for delete
router.post('/requisitions', createRequisition);
router.get('/requisitions', getRequisitions);
router.patch('/requisitions/:id/status', updateRequisitionStatus);
router.delete('/requisitions/:id', requireAdmin, deleteRequisition);

// Purchase Orders — internal document, admin only for mutations
router.post('/purchase-orders', createPurchaseOrder);
router.get('/purchase-orders', getPurchaseOrders);
router.put('/purchase-orders/:id', requireAdmin, updatePurchaseOrder);
router.delete('/purchase-orders/:id', requireAdmin, deletePurchaseOrder);

// Goods Received — use Supplier Return credit note for corrections
router.post('/goods-received', receiveGoods);
router.get('/goods-received', getGoodsReceived);
router.delete('/goods-received/:id', requireAdmin, deleteGoodsReceived);

// Vendor invoices
router.post('/vendor-invoices', createVendorInvoice);
router.get('/vendor-invoices', getVendorInvoices);
router.delete('/vendor-invoices/:id', requireAdmin, deleteVendorInvoice);

router.get('/summary', getProcurementSummary);

export default router;
