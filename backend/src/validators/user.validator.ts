import { z } from 'zod';
import { passwordSchema } from './password.validator';
import { queryBoolean } from './common.validator';

export const userListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  isActive: queryBoolean.optional(),
  roleId: z.string().uuid().optional(),
});

export const userCreateSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  roleId: z.string().uuid('El roleId debe ser un UUID válido.'),
  password: passwordSchema,
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional().or(z.literal('')),
  roleId: z.string().uuid().optional(),
});

export { setActiveSchema } from './common.validator';
