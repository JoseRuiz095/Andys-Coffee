import { z } from 'zod';

export const paginationFields = {
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const normalizedSearchSchema = z.string().trim().max(100).transform((value) => value || undefined);