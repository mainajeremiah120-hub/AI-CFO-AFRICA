import express from 'express';
import { register, login, setup2FA, verify2FASetup, disable2FA, validate2FA } from './auth.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

// 2FA routes
router.get('/2fa/setup', protect, setup2FA);
router.post('/2fa/setup/verify', protect, verify2FASetup);
router.post('/2fa/disable', protect, disable2FA);
router.post('/2fa/validate', validate2FA);  // no protect — uses partial token

export default router;
