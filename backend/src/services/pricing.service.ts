import { Prisma, PromotionType } from '@prisma/client';

export type PricingPromotion = {
  id: string;
  type: PromotionType;
  discountValue: Prisma.Decimal;
  buyQuantity: number | null;
  getQuantity: number | null;
};

export type PromotionPricingResult = {
  promotion: PricingPromotion | null;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
};

const ZERO = new Prisma.Decimal(0);
const ONE_HUNDRED = new Prisma.Decimal(100);

const roundMoney = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export const isValidPromotion = (promotion: PricingPromotion): boolean => {
  if (!promotion.discountValue.isFinite() || promotion.discountValue.lt(0)) return false;
  if (promotion.type === PromotionType.PERCENTAGE) {
    return promotion.discountValue.lte(ONE_HUNDRED);
  }
  if (promotion.type === PromotionType.BOGO) {
    return promotion.discountValue.lte(ONE_HUNDRED)
      && Number.isInteger(promotion.buyQuantity)
      && (promotion.buyQuantity ?? 0) >= 1
      && Number.isInteger(promotion.getQuantity)
      && (promotion.getQuantity ?? 0) >= 1;
  }
  if (promotion.type === PromotionType.FIXED_DISCOUNT || promotion.type === PromotionType.FIXED_PRICE) {
    return promotion.discountValue.gt(ZERO);
  }
  if (promotion.type === PromotionType.MULTIBUY_FIXED_PRICE) {
    return promotion.discountValue.gt(ZERO)
      && Number.isInteger(promotion.buyQuantity)
      && (promotion.buyQuantity ?? 0) >= 2;
  }
  return false;
};

const calculateDiscount = (
  unitPrice: Prisma.Decimal,
  quantity: number,
  promotion: PricingPromotion,
): Prisma.Decimal => {
  if (!isValidPromotion(promotion) || quantity <= 0) return ZERO;

  if (promotion.type === PromotionType.PERCENTAGE) {
    return roundMoney(unitPrice.mul(quantity).mul(promotion.discountValue).div(ONE_HUNDRED));
  }
  if (promotion.type === PromotionType.FIXED_DISCOUNT) {
    return roundMoney(Prisma.Decimal.min(unitPrice, promotion.discountValue).mul(quantity));
  }
  if (promotion.type === PromotionType.FIXED_PRICE) {
    return roundMoney(Prisma.Decimal.max(ZERO, unitPrice.sub(promotion.discountValue)).mul(quantity));
  }
  if (promotion.type === PromotionType.MULTIBUY_FIXED_PRICE) {
    const buyQuantity = promotion.buyQuantity ?? 0;
    const groups = Math.floor(quantity / buyQuantity);
    return roundMoney(Prisma.Decimal.max(
      ZERO,
      unitPrice.mul(buyQuantity).sub(promotion.discountValue),
    ).mul(groups));
  }

  const buyQuantity = promotion.buyQuantity ?? 0;
  const getQuantity = promotion.getQuantity ?? 0;
  const groupSize = buyQuantity + getQuantity;
  if (groupSize <= 0) return ZERO;
  const freeUnits = Math.floor(quantity / groupSize) * getQuantity;
  return roundMoney(unitPrice.mul(freeUnits).mul(promotion.discountValue).div(ONE_HUNDRED));
};

/** Which products a promotion covers: listed products, or any product of a listed category. */
export type PromotionScope = {
  products: { productId: string }[];
  categories: { categoryId: string }[];
};

/**
 * Promotions that apply to one product (N-01). A promotion only covers the products and
 * categories it is linked to; one without links covers nothing.
 */
export const promotionsForProduct = <T extends PromotionScope>(
  promotions: T[],
  product: { id: string; categoryId: string | null },
): T[] => promotions.filter((promotion) =>
  promotion.products.some(({ productId }) => productId === product.id)
  || (product.categoryId !== null && promotion.categories.some(({ categoryId }) => categoryId === product.categoryId)));

export const calculateBestPromotion = (
  unitPrice: Prisma.Decimal,
  quantity: number,
  promotions: PricingPromotion[],
): PromotionPricingResult => {
  const regularTotal = roundMoney(unitPrice.mul(quantity));
  let bestPromotion: PricingPromotion | null = null;
  let bestDiscount = ZERO;

  for (const promotion of promotions) {
    const discount = Prisma.Decimal.min(calculateDiscount(unitPrice, quantity, promotion), regularTotal);
    if (discount.gt(bestDiscount)) {
      bestPromotion = promotion;
      bestDiscount = discount;
    }
  }

  return {
    promotion: bestPromotion,
    discount: bestDiscount,
    total: roundMoney(Prisma.Decimal.max(ZERO, regularTotal.sub(bestDiscount))),
  };
};

/** A priced cart line a promotion may cover (combos are excluded by the caller). */
export type PromotionCartLine = {
  unitPrice: Prisma.Decimal;
  quantity: number;
  product: { id: string; categoryId: string | null };
};

type Unit = { line: number; price: Prisma.Decimal };

const isQuantityPromotion = (promotion: PricingPromotion) =>
  promotion.type === PromotionType.BOGO || promotion.type === PromotionType.MULTIBUY_FIXED_PRICE;

/** Every unit of `lines` (by index in `lines`), most expensive first. */
function expandUnits(lines: PromotionCartLine[], lineIndexes: number[]): Unit[] {
  const units = lineIndexes.flatMap((line) =>
    Array.from({ length: lines[line].quantity }, () => ({ line, price: lines[line].unitPrice })));
  return units.sort((a, b) => b.price.comparedTo(a.price));
}

/**
 * Discount per line (indexed like `lines`) that `promotion` gives to the lines in `covered`.
 * Per-unit promotions are computed line by line; quantity promotions (2x1, n por $X) pool the
 * units of every covered line — whatever temperature, size or note they were captured with —
 * and group the most expensive units first: in a 2x1 the cheaper unit of each pair is the free
 * one, and an "n por $X" group takes the units that save the most. Each group's discount is
 * split over its units in whole cents, so line discounts add up exactly.
 */
function promotionDiscounts(
  lines: PromotionCartLine[],
  covered: number[],
  promotion: PricingPromotion,
): Prisma.Decimal[] {
  const discounts = lines.map(() => ZERO);
  if (!isValidPromotion(promotion)) return discounts;

  if (!isQuantityPromotion(promotion)) {
    for (const line of covered) {
      const regular = roundMoney(lines[line].unitPrice.mul(lines[line].quantity));
      discounts[line] = Prisma.Decimal.min(calculateDiscount(lines[line].unitPrice, lines[line].quantity, promotion), regular);
    }
    return discounts;
  }

  const units = expandUnits(lines, covered);
  const buyQuantity = promotion.buyQuantity ?? 0;

  if (promotion.type === PromotionType.BOGO) {
    const getQuantity = promotion.getQuantity ?? 0;
    const groupSize = buyQuantity + getQuantity;
    for (let start = 0; start + groupSize <= units.length; start += groupSize) {
      // The last `getQuantity` units of a group are its cheapest: those are discounted.
      for (const unit of units.slice(start + buyQuantity, start + groupSize)) {
        discounts[unit.line] = discounts[unit.line].add(roundMoney(unit.price.mul(promotion.discountValue).div(ONE_HUNDRED)));
      }
    }
    return discounts;
  }

  // MULTIBUY_FIXED_PRICE: each group of `buyQuantity` units costs `discountValue`.
  for (let start = 0; start + buyQuantity <= units.length; start += buyQuantity) {
    const group = units.slice(start, start + buyQuantity);
    const groupPrice = group.reduce((total, unit) => total.add(unit.price), ZERO);
    const groupDiscount = roundMoney(Prisma.Decimal.max(ZERO, groupPrice.sub(promotion.discountValue)));
    let allocated = ZERO;
    group.forEach((unit, index) => {
      const share = index === group.length - 1
        ? groupDiscount.sub(allocated)
        : groupDiscount.mul(unit.price).div(groupPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
      allocated = allocated.add(share);
      discounts[unit.line] = discounts[unit.line].add(share);
    });
  }
  return discounts;
}

/**
 * Promotion discount of each cart line (same order as `lines`). Promotions don't stack: the one
 * that saves the most over the whole cart is applied first and takes every line it covers, then
 * the next best among the remaining lines, and so on. A promotion only covers the products and
 * categories it is linked to (N-01).
 */
export function calculateCartPromotions<T extends PricingPromotion & PromotionScope>(
  lines: PromotionCartLine[],
  promotions: T[],
): Prisma.Decimal[] {
  const result = lines.map(() => ZERO);
  const available = new Set(lines.map((_, index) => index));
  const pending = promotions.filter(isValidPromotion);

  while (pending.length > 0 && available.size > 0) {
    let best: { promotionIndex: number; covered: number[]; discounts: Prisma.Decimal[]; total: Prisma.Decimal } | null = null;

    pending.forEach((promotion, promotionIndex) => {
      const covered = [...available].filter((line) => promotionsForProduct([promotion], lines[line].product).length > 0);
      if (covered.length === 0) return;
      const discounts = promotionDiscounts(lines, covered, promotion);
      const total = discounts.reduce((sum, discount) => sum.add(discount), ZERO);
      if (total.gt(best?.total ?? ZERO)) best = { promotionIndex, covered, discounts, total };
    });

    if (!best) break;
    const chosen: { promotionIndex: number; covered: number[]; discounts: Prisma.Decimal[] } = best;
    for (const line of chosen.covered) {
      result[line] = chosen.discounts[line];
      available.delete(line);
    }
    pending.splice(chosen.promotionIndex, 1);
  }

  return result;
}
