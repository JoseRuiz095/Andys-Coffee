import { SETTINGS_PERMISSION } from '../config/permissions';
import express from 'express';
import {
  getDay,
  getDayDetail,
  getWeek,
  getMonth,
  getRange,
  getDistributionSettings,
  updateDistributionSettings,
  getFixedExpenseSettings,
  upsertFixedExpenseConcept,
  deleteFixedExpenseConcept,
  updateAccumulatedBalances,
} from '../controllers/income-statement.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import {
  accumulatedBalancesSchema,
  distributionSettingsSchema,
  fixedExpenseConceptSchema,
} from '../validators/income-statement.validator';

const router = express.Router();

router.use(requireAuth);

router.get('/day', checkPermission('dashboard.read'), getDay);
router.get('/day-detail', checkPermission('dashboard.read'), getDayDetail);
router.get('/week', checkPermission('dashboard.read'), getWeek);
router.get('/month', checkPermission('dashboard.read'), getMonth);
router.get('/range', checkPermission('dashboard.read'), getRange);
router.get('/settings/distribution', checkPermission('dashboard.read'), getDistributionSettings);
router.patch('/settings/distribution', checkPermission(SETTINGS_PERMISSION), validate(distributionSettingsSchema), updateDistributionSettings);
router.get('/settings/fixed-expenses', checkPermission('dashboard.read'), getFixedExpenseSettings);
router.put('/settings/fixed-expenses/:slug', checkPermission(SETTINGS_PERMISSION), validate(fixedExpenseConceptSchema), upsertFixedExpenseConcept);
router.delete('/settings/fixed-expenses/:slug', checkPermission(SETTINGS_PERMISSION), deleteFixedExpenseConcept);
router.patch('/day/accumulated-balances', checkPermission(SETTINGS_PERMISSION), validate(accumulatedBalancesSchema), updateAccumulatedBalances);

export default router;
