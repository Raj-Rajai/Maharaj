import { Router } from 'express';
import * as billController from '../controllers/billController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { previewBillSchema, createBillSchema, finalizeBillSchema } from '../validators/billValidator.js';

const router = Router();

router.use(authenticate);

router.post('/preview', validate(previewBillSchema), billController.preview);
router.post('/', requirePermission('BILL_VIEW_DRAFT'), validate(createBillSchema), billController.create);
router.get('/', billController.getAll);
router.get('/:id', billController.getById);
router.get('/:id/print', requirePermission('BILL_PRINT'), billController.getPrintData);
router.get('/:id/amendments', billController.getAmendments);
router.post('/:id/finalize', requirePermission('BILL_FINALIZE'), validate(finalizeBillSchema), billController.finalize);
router.post('/:id/cancel', requirePermission('BILL_CANCEL'), billController.cancel);
router.post('/:id/amend', requirePermission('BILL_AMEND'), billController.amendBill);
router.post('/amendments/:id/settle', requirePermission('BILL_AMEND'), billController.settleAmendment);
router.patch('/:id/edit', requirePermission('BILL_EDIT'), billController.editDraft);

export default router;
