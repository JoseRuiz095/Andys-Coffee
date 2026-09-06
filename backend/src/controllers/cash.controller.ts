import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { CashService } from '../services/cash.service';
import { closeCashSessionSchema, correctCashClosingSchema, openCashSessionSchema } from '../validators/cash.validator';

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
  res.status(201).json({ session });
});

export const closeCashSession = asyncHandler(async (req: Request, res: Response) => {
  const input = closeCashSessionSchema.parse(req.body);
  const session = await CashService.closeSession(getAuthenticatedUserId(req), input);
  res.status(200).json({ session });
});

export const correctCashClosing = asyncHandler(async (req: Request, res: Response) => {
  const input = correctCashClosingSchema.parse(req.body);
  const session = await CashService.correctClosing(
    getAuthenticatedUserId(req),
    String(req.params.sessionId),
    input,
  );
  res.status(200).json({ session });
});
