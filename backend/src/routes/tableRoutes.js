import { Router } from 'express';
import * as tableController from '../controllers/tableController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateStatusSchema } from '../validators/tableValidator.js';

const router = Router();

router.get('/', authenticate, requirePermission('TABLE_VIEW'), tableController.getAll);
router.get('/:id', authenticate, requirePermission('TABLE_VIEW'), tableController.getById);
router.post('/', authenticate, requirePermission('TABLE_CREATE'), tableController.create);
router.patch('/:id', authenticate, requirePermission('TABLE_EDIT'), tableController.update);
router.patch('/:id/status', authenticate, validate(updateStatusSchema), tableController.updateStatus);
router.post('/:id/close', authenticate, requirePermission('TABLE_EDIT', 'ORDER_CANCEL', 'ORDER_EDIT', 'BILL_FINALIZE'), tableController.closeTable);
router.delete('/:id', authenticate, requirePermission('TABLE_DELETE'), tableController.remove);

export default router;
