import { z } from 'zod';

const periodSchema = z.enum(['today', 'yesterday', 'week', 'month', 'customRange']);

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');

export const dashboardSummaryQuerySchema = z.object({
  period: periodSchema.default('today'),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  cashRegisterId: z.string().uuid().optional(),
}).refine(
  (data) => {
    if (data.period === 'customRange' && (!data.from || !data.to)) {
      return false;
    }
    return true;
  },
  { message: 'from and to are required when period is customRange' }
).refine(
  (data) => {
    if (data.from && data.to && data.from > data.to) {
      return false;
    }
    return true;
  },
  { message: 'from must be <= to' }
);

export const dashboardSalesQuerySchema = z.object({
  period: periodSchema.default('today'),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(5),
}).refine(
  (data) => {
    if (data.period === 'customRange' && (!data.from || !data.to)) {
      return false;
    }
    return true;
  },
  { message: 'from and to are required when period is customRange' }
).refine(
  (data) => {
    if (data.from && data.to && data.from > data.to) {
      return false;
    }
    return true;
  },
  { message: 'from must be <= to' }
);

export const dashboardInventoryQuerySchema = z.object({
  onlyLow: z.coerce.boolean().default(false),
}).optional();

export const dashboardCostsQuerySchema = z.object({
  period: periodSchema.default('today'),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
}).refine(
  (data) => {
    if (data.period === 'customRange' && (!data.from || !data.to)) {
      return false;
    }
    return true;
  },
  { message: 'from and to are required when period is customRange' }
).refine(
  (data) => {
    if (data.from && data.to && data.from > data.to) {
      return false;
    }
    return true;
  },
  { message: 'from must be <= to' }
);

export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;
export type DashboardSalesQuery = z.infer<typeof dashboardSalesQuerySchema>;
export type DashboardInventoryQuery = z.infer<typeof dashboardInventoryQuerySchema>;
export type DashboardCostsQuery = z.infer<typeof dashboardCostsQuerySchema>;
