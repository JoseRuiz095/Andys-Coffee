import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as OrderService from '../services/order.service';
import { prisma } from '../config/prisma';

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const order = await OrderService.OrderService.create(req.body, userId);

  res.status(201).json(order);
});
