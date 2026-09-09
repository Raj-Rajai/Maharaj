import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateSettingsSchema } from '../validators/settingsValidator.js';

const router = Router();

router.get('/', authenticate, settingsController.get);
router.put('/', authenticate, requirePermission('SETTINGS_EDIT'), validate(updateSettingsSchema), settingsController.update);

export default router;
