import { z } from 'zod';

export const expenseCategories = ['insumos', 'servicios', 'mantenimiento', 'nomina', 'renta', 'otros'] as const;
export const expensePaymentMethods = ['cash', 'transfer', 'card'] as const;

export const createExpenseSchema = z.object({
  category: z.enum(expenseCategories),
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().finite().positive().max(999999999.99),
  paymentMethod: z.enum(expensePaymentMethods).default('cash'),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = createExpenseSchema.partial();

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const expenseListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(expenseCategories).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  createdById: z.string().uuid().optional(),
  cashSessionId: z.string().uuid().optional(),
});

export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;
