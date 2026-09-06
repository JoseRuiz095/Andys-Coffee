import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma, PromotionType } from '@prisma/client';
import { calculateBestPromotion } from '../src/services/pricing.service';

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