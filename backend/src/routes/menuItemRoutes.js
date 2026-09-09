import { Router } from 'express';
import * as menuItemController from '../controllers/menuItemController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createMenuItemSchema, updateMenuItemSchema, updateAvailabilitySchema, bulkAddMenuItemSchema } from '../validators/menuItemValidator.js';

const router = Router();

router.get('/', authenticate, menuItemController.getAll);
router.get('/:id', authenticate, menuItemController.getById);
router.post('/', authenticate, requirePermission('MENU_AC_CREATE', 'MENU_NON_AC_CREATE', 'MENU_SWIGGY_CREATE', 'MENU_ZOMATO_CREATE'), validate(createMenuItemSchema), menuItemController.create);
router.post('/bulk', authenticate, requirePermission('MENU_BULK_ADD'), validate(bulkAddMenuItemSchema), menuItemController.bulkAdd);
router.put('/bulk', authenticate, requirePermission('MENU_BULK_ADD'), validate(bulkAddMenuItemSchema), menuItemController.bulkUpdate);
router.patch('/:id', authenticate, requirePermission('MENU_AC_EDIT', 'MENU_NON_AC_EDIT', 'MENU_SWIGGY_EDIT', 'MENU_ZOMATO_EDIT'), validate(updateMenuItemSchema), menuItemController.update);
router.patch('/:id/availability', authenticate, requirePermission('MENU_AC_EDIT', 'MENU_NON_AC_EDIT', 'MENU_SWIGGY_EDIT', 'MENU_ZOMATO_EDIT'), validate(updateAvailabilitySchema), menuItemController.updateAvailability);
router.delete('/:id', authenticate, requirePermission('MENU_AC_DELETE', 'MENU_NON_AC_DELETE', 'MENU_SWIGGY_DELETE', 'MENU_ZOMATO_DELETE'), menuItemController.softDelete);

export default router;
