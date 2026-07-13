import express from 'express';
import { getAuditLogs, clearOldLogs } from './audit.controller.js';
import { protect, requireAdmin } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/', getAuditLogs);
router.delete('/old', requireAdmin, clearOldLogs);

export default router;
