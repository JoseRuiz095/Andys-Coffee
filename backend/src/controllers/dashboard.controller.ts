import type { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import {
  dashboardSummaryQuerySchema,
  dashboardSalesQuerySchema,
  dashboardInventoryQuerySchema,
  dashboardCostsQuerySchema,
} from '../validators/dashboard.validator';
import { asyncHandler } from '../utils/asyncHandler';

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const query = dashboardSummaryQuerySchema.parse(req.query);
  const summary = await dashboardService.getSummary(query);
  res.status(200).json(summary);
});

export const getSales = asyncHandler(async (req: Request, res: Response) => {
  const query = dashboardSalesQuerySchema.parse(req.query);
  const sales = await dashboardService.getSales(query);
  res.status(200).json(sales);
});

export const getInventory = asyncHandler(async (req: Request, res: Response) => {
  const query = dashboardInventoryQuerySchema.parse(req.query);
  const inventory = await dashboardService.getInventory(query);
  res.status(200).json(inventory);
});

export const getCosts = asyncHandler(async (req: Request, res: Response) => {
  const query = dashboardCostsQuerySchema.parse(req.query);
  const costs = await dashboardService.getCosts(query);
  res.status(200).json(costs);
});
