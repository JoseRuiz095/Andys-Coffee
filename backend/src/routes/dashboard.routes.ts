import express from 'express';
import { getSummary, getSales, getInventory, getCosts } from '../controllers/dashboard.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';

const router = express.Router();

router.get('/summary', requireAuth, checkPermission('dashboard.read'), getSummary);
router.get('/sales', requireAuth, checkPermission('dashboard.read'), getSales);
router.get('/inventory', requireAuth, checkPermission('dashboard.read'), getInventory);
router.get('/costs', requireAuth, checkPermission('dashboard.read'), getCosts);

export default router;
