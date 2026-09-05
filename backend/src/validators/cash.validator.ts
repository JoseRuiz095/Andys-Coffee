import { z } from 'zod';

export const openCashSessionSchema = z.object({
  openingAmount: z.coerce.number().finite().min(0).max(999999999.99),
  cashRegisterId: z.string().uuid().optional(),
});

export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;
