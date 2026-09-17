import { z } from 'zod';

export const openCashSessionSchema = z.object({
  openingAmount: z.coerce.number().finite().min(0).max(999999999.99),
  cashRegisterId: z.string().uuid().optional(),
});

export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;

export const closeCashSessionSchema = z.object({
  closingAmount: z.coerce.number().finite().min(0).max(999999999.99),
  reason: z.string().trim().max(120).optional(),
  comment: z.string().trim().max(500).optional(),
});

export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;

export const correctCashClosingSchema = z.object({
  correctedAmount: z.coerce.number().finite().min(0).max(999999999.99),
  reason: z.string().trim().min(1).max(120),
  comment: z.string().trim().max(500).optional(),
});

export type CorrectCashClosingInput = z.infer<typeof correctCashClosingSchema>;

export const cashSessionHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cashRegisterId: z.string().uuid().optional(),
  status: z.enum(['open', 'closed']).optional(),
});

export type CashSessionHistoryQuery = z.infer<typeof cashSessionHistoryQuerySchema>;
