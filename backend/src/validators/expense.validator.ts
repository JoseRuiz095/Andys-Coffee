import { z } from 'zod';

// NOTA: 'nomina' y 'servicios' aquí son para gastos ad-hoc/puntuales. Los costos fijos
// recurrentes (Luz, Sueldos) se cubren con la tarifa diaria bajo las claves SystemPreference
// `expenses.fixed.*` (ver income-statement.repository.ts) y ya se deducen automáticamente
// en el Estado de Resultados como "Gastos Operativos Fijos". NO registrarlos también aquí —
// se duplicarían contra la ganancia neta. Convención documentada, no forzada por el sistema.
export const expenseCategories = ['insumos', 'servicios', 'mantenimiento', 'nomina', 'renta', 'mandadito', 'otros'] as const;
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
