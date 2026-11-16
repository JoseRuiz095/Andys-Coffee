/**
 * F3 (estabilización 2026-11-14): a retried sale (same idempotency key) must be the SAME sale.
 * Before, a reused key with a different cart silently returned the first order with 201 and the
 * new sale was never recorded. Compares what identifies a cart without re-pricing it (prices or
 * promotions may have changed since): products with size and quantity, extras per product,
 * combos and the payment method. Promotions can split a request line into several stored lines
 * of the same product, so quantities are summed per key.
 */

interface RequestedItem {
  productId?: string;
  comboId?: string;
  quantity: number;
  size?: string;
  extras?: { extraId: string }[];
}

interface StoredItem {
  productId: string;
  size: string;
  quantity: { toString(): string } | number;
  sourceComboId: string | null;
  extras: { extraId: string | null }[];
}

function fingerprintRequest(items: RequestedItem[]) {
  const quantities = new Map<string, number>();
  const tags = new Set<string>();
  for (const item of items) {
    if (item.comboId) {
      tags.add(`combo:${item.comboId}`);
      continue;
    }
    const key = `product:${item.productId}:${item.size ?? 'REGULAR'}`;
    quantities.set(key, (quantities.get(key) ?? 0) + item.quantity);
    for (const extra of item.extras ?? []) tags.add(`extra:${item.productId}:${extra.extraId}`);
  }
  return { quantities, tags };
}

function fingerprintStored(items: StoredItem[]) {
  const quantities = new Map<string, number>();
  const tags = new Set<string>();
  for (const item of items) {
    if (item.sourceComboId) {
      tags.add(`combo:${item.sourceComboId}`);
      continue;
    }
    const key = `product:${item.productId}:${item.size}`;
    quantities.set(key, (quantities.get(key) ?? 0) + Number(item.quantity.toString()));
    for (const extra of item.extras) tags.add(`extra:${item.productId}:${extra.extraId}`);
  }
  return { quantities, tags };
}

const sameMap = (a: Map<string, number>, b: Map<string, number>) =>
  a.size === b.size && [...a].every(([key, value]) => Math.abs((b.get(key) ?? Number.NaN) - value) < 1e-9);
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((key) => b.has(key));

export function isSameIdempotentOrder(
  stored: { items: StoredItem[]; payments: { method: string }[] },
  request: { items: RequestedItem[]; paymentMethod: string },
): boolean {
  const a = fingerprintStored(stored.items);
  const b = fingerprintRequest(request.items);
  const storedMethod = stored.payments[0]?.method;
  const sameMethod = storedMethod === undefined || storedMethod === request.paymentMethod;
  return sameMethod && sameMap(a.quantities, b.quantities) && sameSet(a.tags, b.tags);
}
