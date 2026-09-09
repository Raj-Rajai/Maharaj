import { Router } from 'express';
import * as kotController from '../controllers/kotController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createKotSchema, updateKotStatusSchema, updateItemStatusSchema } from '../validators/kotValidator.js';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('KOT_CREATE'), validate(createKotSchema), kotController.create);
router.get('/', requirePermission('KOT_VIEW'), kotController.getAll);
router.get('/:id', requirePermission('KOT_VIEW'), kotController.getById);
router.patch('/:id/status', requirePermission('KOT_EDIT'), validate(updateKotStatusSchema), kotController.updateStatus);
router.patch('/items/:itemId/status', requirePermission('KOT_EDIT'), validate(updateItemStatusSchema), kotController.updateItemStatus);
router.patch('/items/:itemId/edit', requirePermission('KOT_EDIT'), kotController.editItemQuantity);
router.patch('/items/:itemId/cancel', requirePermission('ORDER_CANCEL'), kotController.cancelItem);

export default router;

