import { z } from 'zod';
import { queryBoolean } from './common.validator';

export const supplierListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  isActive: queryBoolean.optional(),
});

// QA audit 2026-11-18: the name is trimmed before its length is checked (D-04: "   " was saved as
// ""), and the phone only takes digits and the usual separators (D-08: any text was accepted).
// An empty phone/email/address means "none".
const supplierNameSchema = z.string().trim().min(1, 'El nombre del proveedor es requerido.').max(255);
const supplierPhoneSchema = z.string().trim().max(50)
  .refine((phone) => phone === '' || /^\+?[0-9()\-.\s]{7,20}(\s*(ext\.?|x)\s*\d{1,6})?$/i.test(phone), 'El teléfono solo puede tener números, espacios, guiones, paréntesis y un + inicial (7 a 20 caracteres).');
const supplierEmailSchema = z.string().trim().toLowerCase().max(255)
  .refine((email) => email === '' || z.string().email().safeParse(email).success, 'El correo del proveedor no es válido.');

export const supplierCreateSchema = z.object({
  name: supplierNameSchema,
  phone: supplierPhoneSchema.optional(),
  email: supplierEmailSchema.optional(),
  address: z.string().trim().max(500).optional(),
});

export const supplierUpdateSchema = z.object({
  name: supplierNameSchema.optional(),
  phone: supplierPhoneSchema.optional(),
  email: supplierEmailSchema.optional(),
  address: z.string().trim().max(500).optional(),
});
