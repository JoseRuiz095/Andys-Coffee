import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { CashService } from '../services/cash.service';
import { openCashSessionSchema } from '../validators/cash.validator';

function getAuthenticatedUserId(req: Request) {
  if (!req.user?.id) {
    throw new Error('Authentication required.');
  }
  return req.user.id;
}

export const getActiveCashSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await CashService.getActiveSession();
  if (session && new Date().getHours() >= 14) {
    await CashService.closeIfBusinessDayEnded(getAuthenticatedUserId(req));
    return res.status(200).json({ session: null });
  }
  res.status(200).json({ session });
});

export const openCashSession = asyncHandler(async (req: Request, res: Response) => {
  const input = openCashSessionSchema.parse(req.body);
  const session = await CashService.openSession(input, getAuthenticatedUserId(req));
  res.status(201).json({ session });
});

export const closeCashSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await CashService.closeSession(getAuthenticatedUserId(req));
  res.status(200).json({ session });
});
