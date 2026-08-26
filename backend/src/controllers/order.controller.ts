import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { OrderService } from '../services/order.service';
import { filterQuerySchema, updateOrderStatusSchema } from '../validators/order.validator';

export const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
  const query = await filterQuerySchema.parseAsync(req.query);
  const result = await OrderService.findAll(query);
  res.status(200).json(result);
});

export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const order = await OrderService.findOne(id);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }
  res.status(200).json(order);
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const order = await OrderService.create(req.body, userId);
  res.status(201).json(order);
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const statusData = await updateOrderStatusSchema.parseAsync(req.body);
  const order = await OrderService.updateStatus(id, statusData);
  res.status(200).json(order);
});
