import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { OrderService } from '../services/order.service';
import { filterQuerySchema, updateOrderStatusSchema } from '../validators/order.validator';
import { AuthUser } from '../services/auth.service';

const getAuthenticatedUser = (req: Request): AuthUser => {
  if (!req.user) {
    // This should not happen if requireAuth middleware is used, but it's a safeguard.
    throw new Error('Authentication required.');
  }
  return req.user as AuthUser;
}

export const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  const query = await filterQuerySchema.parseAsync(req.query);
  const result = await OrderService.findAll(query, user);
  res.status(200).json(result);
});

export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  const id = String(req.params.id);
  const order = await OrderService.findOne(id, user);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }
  res.status(200).json(order);
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  const idempotencyKey = req.header('X-Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.length > 100) {
    return res.status(400).json({ message: 'X-Idempotency-Key es requerido y debe tener como máximo 100 caracteres.' });
  }
  const order = await OrderService.create(req.body, user.id, idempotencyKey);
  res.status(201).json(order);
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  const id = String(req.params.id);
  const statusData = await updateOrderStatusSchema.parseAsync(req.body);

  try {
    const order = await OrderService.updateStatus(id, statusData, user);
    res.status(200).json(order);
  } catch (error: any) {
    if (error.name === 'StateTransitionError') {
      return res.status(409).json({ message: error.message });
    }
    // Other errors (like not found) will be handled by the generic error handler
    throw error;
  }
});
