import { Router } from 'express';
import * as paymentController from '../controllers/paymentController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requirePermission('REPORT_VIEW'));

router.get('/', paymentController.getAll);
router.get('/:id', paymentController.getById);

export default router;
