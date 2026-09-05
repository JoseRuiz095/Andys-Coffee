import { Router } from 'express';
import { closeCashSession, getActiveCashSession, openCashSession } from '../controllers/cash.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { openCashSessionSchema } from '../validators/cash.validator';

const router = Router();

router.get('/sessions/active', requireAuth, checkPermission('cash.open'), getActiveCashSession);
router.post(
  '/sessions',
  requireAuth,
  checkPermission('cash.open'),
  validate(openCashSessionSchema),
  openCashSession,
);
router.post('/sessions/close', requireAuth, checkPermission('cash.close'), closeCashSession);

export default router;
