import { Router } from 'express';
import * as controller from '../controllers/reportController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/dashboard', requirePermission('REPORT_VIEW'), controller.getDashboard);
router.get('/sales', requirePermission('REPORT_VIEW'), controller.getSalesSummary);
router.get('/orders', requirePermission('REPORT_VIEW'), controller.getOrderSummary);
router.get('/payments', requirePermission('REPORT_VIEW'), controller.getPaymentBreakdown);
router.get('/tables', requirePermission('REPORT_VIEW'), controller.getTableSummary);
router.get('/online-orders', requirePermission('REPORT_VIEW'), controller.getOnlineOrderSummary);
router.get('/purchases', requirePermission('REPORT_VIEW'), controller.getPurchaseSummary);
router.get('/inventory', requirePermission('REPORT_VIEW'), controller.getInventoryStatus);

export default router;
