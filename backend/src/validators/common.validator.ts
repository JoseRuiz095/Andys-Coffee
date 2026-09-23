import { z } from 'zod';

/** Body of every PATCH /:id/active endpoint. */
export const setActiveSchema = z.object({
  isActive: z.boolean(),
});

/**
 * Boolean query-string flag. z.coerce.boolean() is wrong here: it turns the string "false"
 * into true (any non-empty string is truthy), so ?isActive=false returned the active rows.
 */
export const queryBoolean = z.enum(['true', 'false']).transform((value) => value === 'true');

/** ?q= of the /search endpoints. */
export const searchQuerySchema = z.object({
  q: z.string({ error: 'Parámetro de búsqueda requerido: q' }).trim().min(1, 'Parámetro de búsqueda requerido: q').max(100),
});

export const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.');
