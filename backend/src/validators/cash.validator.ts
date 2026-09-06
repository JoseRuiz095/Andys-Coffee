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
