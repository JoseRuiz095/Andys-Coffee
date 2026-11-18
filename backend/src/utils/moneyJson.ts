import { Prisma } from '@prisma/client';

/** Money columns of orders, their lines, extras and payments (all Decimal(12,2)). */
const MONEY_KEYS = new Set([
  'subtotal', 'discount', 'tax', 'total', 'totalCost', 'deliveryAmount',
  'unitPrice', 'costSnapshot', 'amount', 'receivedAmount', 'changeAmount',
]);

/**
 * Copy of `value` with every money Decimal as a fixed two-decimal string ("200.50"), the format
 * POST /orders/quote already used. Prisma's Decimal serializes without trailing zeros ("200.5"),
 * so the same sale read "200.50" in the quote and "200.5" once charged (QA 2026-11-18, D-07).
 * Other Decimals (quantities, costs per gram) keep their full precision.
 */
export function withMoneyAsFixed<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => withMoneyAsFixed(item)) as T;
  if (!value || typeof value !== 'object' || Prisma.Decimal.isDecimal(value) || value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    out[key] = MONEY_KEYS.has(key) && Prisma.Decimal.isDecimal(field)
      ? (field as Prisma.Decimal).toFixed(2)
      : withMoneyAsFixed(field);
  }
  return out as T;
}
