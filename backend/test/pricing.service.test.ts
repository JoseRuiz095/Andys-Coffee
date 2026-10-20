import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma, PromotionType } from '@prisma/client';
import { calculateBestPromotion, calculateCartPromotions } from '../src/services/pricing.service';

const money = (value: number) => new Prisma.Decimal(value);
const promotion = (type: PromotionType, discountValue: number, options: { buyQuantity?: number; getQuantity?: number } = {}) => ({
  id: `${type}-${discountValue}`,
  type,
  discountValue: money(discountValue),
  buyQuantity: options.buyQuantity ?? null,
  getQuantity: options.getQuantity ?? null,
});

test('calcula los tipos de promoción soportados', () => {
  const cases = [
    [PromotionType.PERCENTAGE, 10, 2, {}, 20],
    [PromotionType.FIXED_DISCOUNT, 10, 2, {}, 20],
    [PromotionType.FIXED_PRICE, 75, 2, {}, 50],
    [PromotionType.BOGO, 100, 2, { buyQuantity: 1, getQuantity: 1 }, 100],
    [PromotionType.MULTIBUY_FIXED_PRICE, 99, 3, { buyQuantity: 2 }, 101],
  ] as const;

  for (const [type, value, quantity, options, expectedDiscount] of cases) {
    const result = calculateBestPromotion(money(100), quantity, [promotion(type, value, options)]);
    assert.equal(result.discount.toNumber(), expectedDiscount);
    assert.equal(result.total.toNumber(), 100 * quantity - expectedDiscount);
  }
});

test('elige el mayor ahorro sin acumular promociones', () => {
  const result = calculateBestPromotion(money(100), 1, [
    promotion(PromotionType.PERCENTAGE, 10, { buyQuantity: 1 }),
    promotion(PromotionType.FIXED_DISCOUNT, 25),
  ]);

  assert.equal(result.discount.toNumber(), 25);
  assert.equal(result.promotion?.type, PromotionType.FIXED_DISCOUNT);
});

test('rechaza descuentos mal configurados y evita totales negativos', () => {
  const result = calculateBestPromotion(money(10), 1, [
    promotion(PromotionType.PERCENTAGE, 150, { buyQuantity: 1 }),
    promotion(PromotionType.BOGO, 100, { buyQuantity: 0, getQuantity: 1 }),
    promotion(PromotionType.FIXED_DISCOUNT, 1000),
  ]);

  assert.equal(result.discount.toNumber(), 10);
  assert.equal(result.total.toNumber(), 0);
});
test('N-01: una promoción solo aplica a sus productos o a los de sus categorías', async () => {
  const { promotionsForProduct } = await import('../src/services/pricing.service');
  const byProduct = { id: 'p1', products: [{ productId: 'latte' }], categories: [] };
  const byCategory = { id: 'p2', products: [], categories: [{ categoryId: 'bagels' }] };
  const unlinked = { id: 'p3', products: [], categories: [] };
  const all = [byProduct, byCategory, unlinked];

  assert.deepEqual(promotionsForProduct(all, { id: 'latte', categoryId: 'bebidas' }).map((p) => p.id), ['p1']);
  assert.deepEqual(promotionsForProduct(all, { id: 'bagel-1', categoryId: 'bagels' }).map((p) => p.id), ['p2']);
  assert.deepEqual(promotionsForProduct(all, { id: 'americano', categoryId: 'bebidas' }), []);
  assert.deepEqual(promotionsForProduct(all, { id: 'sin-categoria', categoryId: null }), []);
});


const scoped = (base: ReturnType<typeof promotion>, productIds: string[]) => ({
  ...base,
  products: productIds.map((productId) => ({ productId })),
  categories: [],
});
const cartLine = (productId: string, unitPrice: number, quantity: number) => ({
  unitPrice: money(unitPrice),
  quantity,
  product: { id: productId, categoryId: null },
});

test('un 2x1 junta unidades de distintas líneas y regala la más barata de cada par', () => {
  const twoForOne = scoped(promotion(PromotionType.BOGO, 100, { buyQuantity: 1, getQuantity: 1 }), ['latte']);
  // Hot and cold captured on separate lines.
  const sameProduct = calculateCartPromotions([cartLine('latte', 65, 1), cartLine('latte', 65, 1)], [twoForOne]);
  assert.deepEqual(sameProduct.map((d) => d.toNumber()), [0, 65]);

  // Jumbo (98) + regular (65): the regular one is free.
  const mixedSizes = calculateCartPromotions([cartLine('latte', 98, 1), cartLine('latte', 65, 1)], [twoForOne]);
  assert.deepEqual(mixedSizes.map((d) => d.toNumber()), [0, 65]);

  // Three units: one pair, the third pays.
  const three = calculateCartPromotions([cartLine('latte', 65, 2), cartLine('latte', 65, 1)], [twoForOne]);
  assert.equal(three.reduce((sum, d) => sum + d.toNumber(), 0), 65);
});

test('"2 por $99" mezcla productos de la promoción y reparte el descuento en centavos exactos', () => {
  const twoFor99 = scoped(promotion(PromotionType.MULTIBUY_FIXED_PRICE, 99, { buyQuantity: 2 }), ['vainilla', 'biscoff']);
  const discounts = calculateCartPromotions([cartLine('vainilla', 65, 1), cartLine('biscoff', 70, 1)], [twoFor99]);
  assert.equal(Math.round(discounts.reduce((sum, d) => sum + d.toNumber(), 0) * 100), 3600); // 135 − 99
  assert.ok(discounts.every((d) => d.toNumber() > 0), 'both lines carry part of the discount');
});

test('las promociones no se acumulan sobre la misma línea y solo cubren sus productos', () => {
  const tenPercent = scoped(promotion(PromotionType.PERCENTAGE, 10), ['latte', 'bagel']);
  const twoForOne = scoped(promotion(PromotionType.BOGO, 100, { buyQuantity: 1, getQuantity: 1 }), ['latte']);
  const discounts = calculateCartPromotions(
    [cartLine('latte', 50, 2), cartLine('bagel', 80, 1), cartLine('other', 40, 1)],
    [tenPercent, twoForOne],
  );
  // The 2x1 saves more on the lattes (50); the bagel still gets the 10% (8); "other" nothing.
  assert.deepEqual(discounts.map((d) => d.toNumber()), [50, 8, 0]);
});
