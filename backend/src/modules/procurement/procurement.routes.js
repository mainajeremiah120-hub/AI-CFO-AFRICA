import express from 'express';
import {
  createVendor, getVendors, updateVendor, deleteVendor,
  createRequisition, getRequisitions, updateRequisitionStatus, deleteRequisition,
  createPurchaseOrder, getPurchaseOrders, updatePurchaseOrder, deletePurchaseOrder,
  receiveGoods, getGoodsReceived, deleteGoodsReceived,
  createVendorInvoice, getVendorInvoices, deleteVendorInvoice,
  getProcurementSummary,
} from './procurement.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post('/vendors', createVendor);
router.get('/vendors', getVendors);
router.put('/vendors/:id', updateVendor);
router.delete('/vendors/:id', deleteVendor);

router.post('/requisitions', createRequisition);
router.get('/requisitions', getRequisitions);
router.patch('/requisitions/:id/status', updateRequisitionStatus);
router.delete('/requisitions/:id', deleteRequisition);

router.post('/purchase-orders', createPurchaseOrder);
router.get('/purchase-orders', getPurchaseOrders);
router.put('/purchase-orders/:id', updatePurchaseOrder);
router.delete('/purchase-orders/:id', deletePurchaseOrder);

router.post('/goods-received', receiveGoods);
router.get('/goods-received', getGoodsReceived);
router.delete('/goods-received/:id', deleteGoodsReceived);

router.post('/vendor-invoices', createVendorInvoice);
router.get('/vendor-invoices', getVendorInvoices);
router.delete('/vendor-invoices/:id', deleteVendorInvoice);

router.get('/summary', getProcurementSummary);

export default router;
