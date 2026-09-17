import express from 'express';
import {
  getDay,
  getDayDetail,
  getWeek,
  getMonth,
  getRange,
  getDistributionSettings,
  updateDistributionSettings,
} from '../controllers/income-statement.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';

const router = express.Router();

router.use(requireAuth);

router.get('/day', checkPermission('dashboard.read'), getDay);
router.get('/day-detail', checkPermission('dashboard.read'), getDayDetail);
router.get('/week', checkPermission('dashboard.read'), getWeek);
router.get('/month', checkPermission('dashboard.read'), getMonth);
router.get('/range', checkPermission('dashboard.read'), getRange);
router.get('/settings/distribution', checkPermission('dashboard.read'), getDistributionSettings);
router.patch('/settings/distribution', checkPermission('users.update'), updateDistributionSettings);

export default router;
