import type { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import {
  dashboardSummaryQuerySchema,
  dashboardSalesQuerySchema,
  dashboardInventoryQuerySchema,
  dashboardSalesTrendQuerySchema,
  dashboardProductCostsQuerySchema,
  dashboardCostEvolutionQuerySchema,
  dashboardExpensesByCategoryQuerySchema,
  dashboardUpcomingPurchasesQuerySchema,
  dashboardRecentMovementsQuerySchema,
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

export const getSalesTrend = asyncHandler(async (req: Request, res: Response) => {
  const query = dashboardSalesTrendQuerySchema.parse(req.query);
  const trend = await dashboardService.getSalesTrend(query);
  res.status(200).json(trend);
});

export const getProductCosts = asyncHandler(async (req: Request, res: Response) => {
  const query = dashboardProductCostsQuerySchema.parse(req.query);
  const costs = await dashboardService.getProductCosts(query);
  res.status(200).json(costs);
});

export const getCostEvolution = asyncHandler(async (req: Request, res: Response) => {
  const query = dashboardCostEvolutionQuerySchema.parse(req.query);
  const evolution = await dashboardService.getCostEvolution(query);
  res.status(200).json(evolution);
});

export const getExpensesByCategory = asyncHandler(async (req: Request, res: Response) => {
  const query = dashboardExpensesByCategoryQuerySchema.parse(req.query);
  const expenses = await dashboardService.getExpensesByCategory(query);
  res.status(200).json(expenses);
});

export const getUpcomingPurchases = asyncHandler(async (req: Request, res: Response) => {
  const query = dashboardUpcomingPurchasesQuerySchema.parse(req.query);
  const purchases = await dashboardService.getUpcomingPurchases(query);
  res.status(200).json(purchases);
});

export const getRecentInventoryMovements = asyncHandler(async (req: Request, res: Response) => {
  const query = dashboardRecentMovementsQuerySchema.parse(req.query);
  const movements = await dashboardService.getRecentInventoryMovements(query);
  res.status(200).json(movements);
});
