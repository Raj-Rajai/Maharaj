import { Router } from 'express';
import * as categoryController from '../controllers/categoryController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createCategorySchema, updateCategorySchema } from '../validators/categoryValidator.js';

const router = Router();

router.get('/', authenticate, categoryController.getAll);
router.get('/:id', authenticate, categoryController.getById);
router.post('/', authenticate, requirePermission('MENU_AC_CREATE', 'MENU_NON_AC_CREATE', 'MENU_SWIGGY_CREATE', 'MENU_ZOMATO_CREATE'), validate(createCategorySchema), categoryController.create);
router.patch('/:id', authenticate, requirePermission('MENU_AC_EDIT', 'MENU_NON_AC_EDIT', 'MENU_SWIGGY_EDIT', 'MENU_ZOMATO_EDIT'), validate(updateCategorySchema), categoryController.update);
router.delete('/:id', authenticate, requirePermission('MENU_AC_DELETE', 'MENU_NON_AC_DELETE', 'MENU_SWIGGY_DELETE', 'MENU_ZOMATO_DELETE'), categoryController.softDelete);

export default router;
