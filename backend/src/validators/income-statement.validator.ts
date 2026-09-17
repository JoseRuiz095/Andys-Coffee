import { z } from 'zod';

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');
const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (YYYY-MM)');
const MAX_RANGE_DAYS = 366;

export const dayQuerySchema = z.object({
  date: dateStringSchema,
  cashRegisterId: z.string().uuid().optional(),
});

export const dayDetailQuerySchema = dayQuerySchema;

export const weekQuerySchema = z.object({
  date: dateStringSchema,
  cashRegisterId: z.string().uuid().optional(),
});

export const monthQuerySchema = z.object({
  month: yearMonthSchema,
  cashRegisterId: z.string().uuid().optional(),
});

export const rangeQuerySchema = z
  .object({
    from: dateStringSchema,
    to: dateStringSchema,
    cashRegisterId: z.string().uuid().optional(),
  })
  .refine((data) => data.from <= data.to, {
    message: 'from debe ser menor o igual que to',
    path: ['from'],
  })
  .refine(
    (data) => {
      const fromMs = Date.parse(`${data.from}T00:00:00Z`);
      const toMs = Date.parse(`${data.to}T00:00:00Z`);
      const days = Math.round((toMs - fromMs) / 86_400_000) + 1;
      return days <= MAX_RANGE_DAYS;
    },
    { message: `El rango no puede exceder ${MAX_RANGE_DAYS} días`, path: ['to'] },
  );

export const distributionSettingsSchema = z
  .object({
    savingsPercent: z.number().min(0).max(100),
    businessFundPercent: z.number().min(0).max(100),
    suppliesPercent: z.number().min(0).max(100),
  })
  .refine(
    (data) => Math.abs(data.savingsPercent + data.businessFundPercent + data.suppliesPercent - 100) < 0.01,
    { message: 'Los porcentajes de distribución deben sumar 100%.' },
  );

export type DayQuery = z.infer<typeof dayQuerySchema>;
export type DayDetailQuery = z.infer<typeof dayDetailQuerySchema>;
export type WeekQuery = z.infer<typeof weekQuerySchema>;
export type MonthQuery = z.infer<typeof monthQuerySchema>;
export type RangeQuery = z.infer<typeof rangeQuerySchema>;
export type DistributionSettingsInput = z.infer<typeof distributionSettingsSchema>;
