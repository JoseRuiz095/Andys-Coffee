import { z } from 'zod';
import { queryBoolean } from './common.validator';

export const supplierListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  isActive: queryBoolean.optional(),
});

export const supplierCreateSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
});

export const supplierUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
});
