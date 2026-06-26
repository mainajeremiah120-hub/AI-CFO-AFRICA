import express from 'express';
import {
  createCreditNote,
  getCreditNotes,
  voidCreditNote,
  deleteCreditNote,
  getCreditNoteSummary,
} from './credit-notes.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/summary', getCreditNoteSummary);
router.get('/', getCreditNotes);
router.post('/', createCreditNote);
router.patch('/:id/void', voidCreditNote);
router.delete('/:id', deleteCreditNote);

export default router;
