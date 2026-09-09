import { Router } from 'express';
import * as controller from '../controllers/auditController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('REPORT_VIEW'), controller.getAll);

export default router;
