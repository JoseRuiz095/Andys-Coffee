import type { Request, Response } from 'express';
import { incomeStatementService } from '../services/income-statement.service';
import {
  dayQuerySchema,
  dayDetailQuerySchema,
  weekQuerySchema,
  monthQuerySchema,
  rangeQuerySchema,
  distributionSettingsSchema,
  fixedExpenseConceptSchema,
  fixedExpenseSlugParamSchema,
  accumulatedBalancesSchema,
} from '../validators/income-statement.validator';
import { asyncHandler } from '../utils/asyncHandler';

export const getDay = asyncHandler(async (req: Request, res: Response) => {
  const query = dayQuerySchema.parse(req.query);
  const summary = await incomeStatementService.getDayFinancials(query.date, query.cashRegisterId);
  res.status(200).json(summary);
});

export const getDayDetail = asyncHandler(async (req: Request, res: Response) => {
  const query = dayDetailQuerySchema.parse(req.query);
  const detail = await incomeStatementService.getDayDetail(query.date, query.cashRegisterId);
  res.status(200).json(detail);
});

export const getWeek = asyncHandler(async (req: Request, res: Response) => {
  const query = weekQuerySchema.parse(req.query);
  const week = await incomeStatementService.getWeekFinancials(query.date, query.cashRegisterId);
  res.status(200).json(week);
});

export const getMonth = asyncHandler(async (req: Request, res: Response) => {
  const query = monthQuerySchema.parse(req.query);
  const month = await incomeStatementService.getMonthFinancials(query.month, query.cashRegisterId);
  res.status(200).json(month);
});

export const getRange = asyncHandler(async (req: Request, res: Response) => {
  const query = rangeQuerySchema.parse(req.query);
  const range = await incomeStatementService.getRangeFinancials(query.from, query.to, query.cashRegisterId);
  res.status(200).json(range);
});

export const getDistributionSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await incomeStatementService.getDistributionSettings();
  res.status(200).json(settings);
});

export const updateDistributionSettings = asyncHandler(async (req: Request, res: Response) => {
  const input = distributionSettingsSchema.parse(req.body);
  const settings = await incomeStatementService.updateDistributionSettings(input);
  res.status(200).json(settings);
});

export const getFixedExpenseSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await incomeStatementService.getFixedExpenseSettings();
  res.status(200).json(settings);
});

export const upsertFixedExpenseConcept = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = fixedExpenseSlugParamSchema.parse(req.params);
  const input = fixedExpenseConceptSchema.parse(req.body);
  const settings = await incomeStatementService.upsertFixedExpenseConcept(slug, input);
  res.status(200).json(settings);
});

export const deleteFixedExpenseConcept = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = fixedExpenseSlugParamSchema.parse(req.params);
  const settings = await incomeStatementService.deleteFixedExpenseConcept(slug);
  res.status(200).json(settings);
});

export const updateAccumulatedBalances = asyncHandler(async (req: Request, res: Response) => {
  const query = dayQuerySchema.parse(req.query);
  const input = accumulatedBalancesSchema.parse(req.body);
  const summary = await incomeStatementService.updateAccumulatedBalances(query.date, input);
  res.status(200).json(summary);
});
