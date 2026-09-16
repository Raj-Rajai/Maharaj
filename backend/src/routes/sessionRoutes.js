import { Router } from 'express';
import * as sessionController from '../controllers/sessionController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createSessionSchema } from '../validators/sessionValidator.js';

const router = Router();

router.post('/', authenticate, validate(createSessionSchema), sessionController.create);
router.get('/active', authenticate, sessionController.getActive);
router.get('/:id', authenticate, sessionController.getById);
router.post('/:id/close', authenticate, requirePermission('TABLE_EDIT', 'ORDER_CANCEL', 'ORDER_EDIT', 'BILL_FINALIZE'), sessionController.close);

export default router;
