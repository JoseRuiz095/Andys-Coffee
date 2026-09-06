import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { CashService } from '../services/cash.service';
import { closeCashSessionSchema, correctCashClosingSchema, openCashSessionSchema } from '../validators/cash.validator';
import { auditLog } from '../utils/logger';

function getAuthenticatedUserId(req: Request) {
  if (!req.user?.id) {
    throw new Error('Authentication required.');
  }
  return req.user.id;
}

export const getActiveCashSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await CashService.getActiveSession();
  res.status(200).json({ session });
});

export const openCashSession = asyncHandler(async (req: Request, res: Response) => {
  const input = openCashSessionSchema.parse(req.body);
  const session = await CashService.openSession(input, getAuthenticatedUserId(req));
  auditLog({
    requestId: req.id,
    actor: { id: getAuthenticatedUserId(req), name: req.user?.name, role: req.user?.roleName },
    action: 'CASH_SESSION_OPENED',
    entity: 'cash_session',
    entityId: session.id,
    amount: session.openingAmount.toFixed(2),
    newState: session.status,
  }, 'Cash session opened');
  res.status(201).json({ session });
});

export const closeCashSession = asyncHandler(async (req: Request, res: Response) => {
  const input = closeCashSessionSchema.parse(req.body);
  const session = await CashService.closeSession(getAuthenticatedUserId(req), input);
  if (session) {
    auditLog({
      requestId: req.id,
      actor: { id: getAuthenticatedUserId(req), name: req.user?.name, role: req.user?.roleName },
      action: 'CASH_SESSION_CLOSED',
      entity: 'cash_session',
      entityId: session.id,
      amount: session.closingAmount?.toFixed(2),
      previousState: 'open',
      newState: session.status,
    }, 'Cash session closed');
  }
  res.status(200).json({ session });
});

export const correctCashClosing = asyncHandler(async (req: Request, res: Response) => {
  const input = correctCashClosingSchema.parse(req.body);
  const session = await CashService.correctClosing(
    getAuthenticatedUserId(req),
    String(req.params.sessionId),
    input,
  );
  auditLog({
    requestId: req.id,
    actor: { id: getAuthenticatedUserId(req), name: req.user?.name, role: req.user?.roleName },
    action: 'CASH_SESSION_CLOSING_CORRECTED',
    entity: 'cash_session',
    entityId: session.id,
    amount: session.closingAmount?.toFixed(2),
    newState: session.status,
  }, 'Cash session closing corrected');
  res.status(200).json({ session });
});
