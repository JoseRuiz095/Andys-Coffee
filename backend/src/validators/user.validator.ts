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

// QA audit 2026-11-18: e-mails are stored trimmed and in lowercase (D-02: "Ana@Cafe.mx" could
// not log in as "ana@cafe.mx") and a name of only spaces is rejected before it is trimmed to ""
// (D-04: the length used to be checked on the untrimmed value).
export const userEmailSchema = z.string().trim().toLowerCase().email('El correo no es válido.').max(255);
const userNameSchema = z.string().trim().min(1, 'El nombre es requerido.').max(255);

export const userCreateSchema = z.object({
  name: userNameSchema,
  email: userEmailSchema,
  roleId: z.string().uuid('El roleId debe ser un UUID válido.'),
  password: passwordSchema,
});

export const userUpdateSchema = z.object({
  name: userNameSchema.optional(),
  email: userEmailSchema.optional().or(z.literal('')),
  roleId: z.string().uuid().optional(),
});

export { setActiveSchema } from './common.validator';
