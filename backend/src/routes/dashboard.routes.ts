import express from 'express';
import {
  getSummary,
  getSales,
  getInventory,
  getSalesTrend,
  getProductCosts,
  getCostEvolution,
  getExpensesByCategory,
  getUpcomingPurchases,
  getRecentInventoryMovements,
} from '../controllers/dashboard.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';

const router = express.Router();

router.get('/summary', requireAuth, checkPermission('dashboard.read'), getSummary);
router.get('/sales', requireAuth, checkPermission('dashboard.read'), getSales);
router.get('/inventory', requireAuth, checkPermission('dashboard.read'), getInventory);
router.get('/sales-trend', requireAuth, checkPermission('dashboard.read'), getSalesTrend);
router.get('/product-costs', requireAuth, checkPermission('dashboard.read'), getProductCosts);
router.get('/cost-evolution', requireAuth, checkPermission('dashboard.read'), getCostEvolution);
router.get('/expenses-by-category', requireAuth, checkPermission('dashboard.read'), getExpensesByCategory);
router.get('/upcoming-inventory', requireAuth, checkPermission('dashboard.read'), getUpcomingPurchases);
router.get('/inventory-movements', requireAuth, checkPermission('dashboard.read'), getRecentInventoryMovements);

export default router;
