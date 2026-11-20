import { z } from 'zod';
import { Prisma } from '@prisma/client';

const PLAIN_DECIMAL = /^\d+(\.\d+)?$/;

/**
 * Non-negative decimal sent as a number or a string ("12.5", " 3 "), returned as a plain
 * decimal string that Prisma.Decimal always accepts. Number() alone let " 5" and "" through and
 * Prisma.Decimal then threw a 500 (QA audit 2026-11-18, D-03); hex, exponents and commas are
 * rejected with the field message instead.
 */
export function decimalInput({ min = 0, max, exclusiveMin = false, message }: { min?: number; max: number; exclusiveMin?: boolean; message: string }) {
  return z.union([z.string(), z.number()]).transform((value, ctx) => {
    const text = typeof value === 'number'
      ? (Number.isFinite(value) ? new Prisma.Decimal(value).toFixed() : '')
      : value.trim();
    const amount = Number(text);
    const inRange = exclusiveMin ? amount > min : amount >= min;
    if (!PLAIN_DECIMAL.test(text) || !inRange || amount > max) {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    return text;
  });
}

/**
 * Id of a catalog row (ingredient, supplier, product family…). New rows get uuids, but the
 * original production catalog kept text ids (ingredients PROD-001…, suppliers PROV-01…), so
 * z.string().uuid() rejected every purchase, exit and count of those rows (2026-11-19).
 */
export const catalogIdSchema = z.string().trim().min(1).max(64);

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
