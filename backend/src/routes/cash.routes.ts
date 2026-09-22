import { Router } from 'express';
import { closeCashSession, correctCashClosing, getActiveCashSession, openCashSession, getCashSessionsHistory, reopenCashSession } from '../controllers/cash.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { closeCashSessionSchema, correctCashClosingSchema, openCashSessionSchema, reopenCashSessionSchema } from '../validators/cash.validator';

const router = Router();

router.get('/sessions', requireAuth, checkPermission('cash.read'), getCashSessionsHistory);
router.get('/sessions/active', requireAuth, checkPermission('cash.open'), getActiveCashSession);
router.post(
  '/sessions',
  requireAuth,
  checkPermission('cash.open'),
  validate(openCashSessionSchema),
  openCashSession,
);
router.post('/sessions/close', requireAuth, checkPermission('cash.close'), validate(closeCashSessionSchema), closeCashSession);
router.patch(
  '/sessions/:sessionId/closing',
  requireAuth,
  checkPermission('cash.correct'),
  validate(correctCashClosingSchema),
  correctCashClosing,
);
router.post(
  '/sessions/:sessionId/reopen',
  requireAuth,
  // Reopening discards a finished cash count, so it needs the same permission as correcting one.
  checkPermission('cash.correct'),
  validate(reopenCashSessionSchema),
  reopenCashSession,
);

export default router;
