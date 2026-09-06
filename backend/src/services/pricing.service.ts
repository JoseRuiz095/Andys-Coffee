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