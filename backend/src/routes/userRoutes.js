import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema, updateStatusSchema } from '../validators/userValidator.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('USER_VIEW'), userController.getAll);
router.post('/', requirePermission('USER_CREATE'), validate(createUserSchema), userController.create);
router.get('/:id', requirePermission('USER_VIEW'), userController.getById);
router.patch('/:id', requirePermission('USER_EDIT'), validate(updateUserSchema), userController.update);
router.patch('/:id/status', requirePermission('USER_EDIT'), validate(updateStatusSchema), userController.updateStatus);
router.get('/:id/permissions', requirePermission('USER_VIEW'), userController.getPermissions);
router.put('/:id/permissions', requirePermission('USER_EDIT'), userController.updatePermissions);
router.delete('/:id', requirePermission('USER_DELETE'), userController.remove);

export default router;
