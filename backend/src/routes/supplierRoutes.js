import { Router } from 'express';
import * as controller from '../controllers/supplierController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createSupplierSchema, updateSupplierSchema } from '../validators/supplierValidator.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('PURCHASE_VIEW'), controller.getAll);
router.post('/', requirePermission('PURCHASE_CREATE'), validate(createSupplierSchema), controller.create);
router.get('/:id', requirePermission('PURCHASE_VIEW'), controller.getById);
router.patch('/:id', requirePermission('PURCHASE_EDIT'), validate(updateSupplierSchema), controller.update);
router.delete('/:id', requirePermission('PURCHASE_DELETE'), controller.remove);

export default router;
