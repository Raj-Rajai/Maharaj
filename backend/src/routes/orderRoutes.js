import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createOrderSchema, addItemsSchema, createTakeAwayOrderSchema } from '../validators/orderValidator.js';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('ORDER_CREATE'), validate(createOrderSchema), orderController.create);
router.post('/send-kot', requirePermission('ORDER_CREATE'), orderController.sendKotOrder);
router.post('/take-away', requirePermission('ONLINE_ORDER_CREATE', 'ORDER_CREATE'), validate(createTakeAwayOrderSchema), orderController.createTakeAway);
router.get('/', orderController.getAll);
router.get('/:id', orderController.getById);
router.post('/:id/items', requirePermission('ORDER_CREATE'), validate(addItemsSchema), orderController.addItems);
router.patch('/:id', requirePermission('ORDER_CANCEL'), orderController.cancel);

export default router;
