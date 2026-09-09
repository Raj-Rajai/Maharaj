import { Router } from 'express';
import * as controller from '../controllers/inventoryController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createInventorySchema, updateInventorySchema, adjustStockSchema } from '../validators/inventoryValidator.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('INVENTORY_VIEW'), controller.getAll);
router.get('/transactions', requirePermission('INVENTORY_VIEW'), controller.getTransactions);
router.post('/adjust', requirePermission('INVENTORY_ADJUST'), validate(adjustStockSchema), controller.adjustStock);
router.get('/:id', requirePermission('INVENTORY_VIEW'), controller.getById);
router.post('/', requirePermission('INVENTORY_CREATE'), validate(createInventorySchema), controller.create);
router.put('/:id', requirePermission('INVENTORY_EDIT'), validate(updateInventorySchema), controller.update);
router.delete('/:id', requirePermission('INVENTORY_EDIT'), controller.remove);

export default router;
