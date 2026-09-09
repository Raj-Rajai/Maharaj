import { Router } from 'express';
import * as controller from '../controllers/onlineOrderController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createOnlineOrderSchema, updateOnlineOrderSchema, updateStatusSchema } from '../validators/onlineOrderValidator.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('ONLINE_ORDER_VIEW'), controller.getAll);
router.post('/', requirePermission('ONLINE_ORDER_CREATE'), validate(createOnlineOrderSchema), controller.create);
router.get('/:id', requirePermission('ONLINE_ORDER_VIEW'), controller.getById);
router.patch('/:id', requirePermission('ONLINE_ORDER_EDIT'), validate(updateOnlineOrderSchema), controller.update);
router.patch('/:id/status', requirePermission('ONLINE_ORDER_EDIT'), validate(updateStatusSchema), controller.updateStatus);

export default router;
