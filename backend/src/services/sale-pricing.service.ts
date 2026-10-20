import { Prisma, type DrinkTemperature } from '@prisma/client';
import type { z } from 'zod';
import type { orderItemSchema } from '../validators/order.validator';
import type { OrderRepository } from '../repositories/order.repository';
import { ValidationError } from '../utils/errors';
import { getDrinkTemperature, isJumboLatteProduct } from '../utils/productTemperature';
import { calculateCartPromotions } from './pricing.service';

/**
 * The single place where a sale is priced. `OrderService.create` (inside its Serializable
 * transaction) and the POS quote endpoint both call it, so the total the cashier sees is the
 * total that gets charged. Pure: it reads the catalog it is given and writes nothing.
 */

export type SaleItemInput = z.infer<typeof orderItemSchema>;
export type SaleCatalog = Awaited<ReturnType<typeof OrderRepository.loadSaleCatalog>>;

export type PricedExtra = {
  extraId: string;
  extraName: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  /** Total cost of the extra line (L-06), not unit cost. */
  costSnapshot: Prisma.Decimal;
};

/** One OrderItem row to persist. A combo produces one line per product it contains. */
export type PricedLine = {
  productId: string;
  productName: string;
  temperature: Exclude<DrinkTemperature, 'BOTH'> | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discount: Prisma.Decimal;
  /** Line amount after its discount, extras excluded (they are priced in `extras`). */
  subtotal: Prisma.Decimal;
  costSnapshot: Prisma.Decimal;
  notes: string | null | undefined;
  sourceComboId: string | null;
  extras: PricedExtra[];
};

/** Pricing of one cart line as the POS sent it (same order as the request). */
export type PricedItem = {
  lines: PricedLine[];
  /** Amount before discounts, extras included. */
  gross: Prisma.Decimal;
  discount: Prisma.Decimal;
  net: Prisma.Decimal;
};

export type PricedSale = {
  items: PricedItem[];
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
  totalCost: Prisma.Decimal;
};

const ZERO = new Prisma.Decimal(0);

const sum = (values: Prisma.Decimal[]) => values.reduce((total, value) => total.add(value), ZERO);

/** Throws ValidationError when the cart references something the catalog doesn't offer. */
function assertCatalogCoversItems(items: SaleItemInput[], catalog: SaleCatalog) {
  const productIds = new Set(catalog.products.map((p) => p.id));
  const comboIds = new Set(catalog.combos.map((c) => c.id));
  const extraIds = new Set(catalog.extras.map((e) => e.id));

  if (items.some((item) => item.productId && !productIds.has(item.productId))) {
    throw new ValidationError('Uno o más productos no existen o están inactivos.');
  }
  if (items.some((item) => item.comboId && !comboIds.has(item.comboId))) {
    throw new ValidationError('Uno o más combos no existen, están inactivos o no están disponibles hoy.');
  }
  if (items.some((item) => item.extras?.some((extra) => !extraIds.has(extra.extraId)))) {
    throw new ValidationError('Uno o más extras no existen o están inactivos.');
  }
  const validProductExtras = new Set(catalog.productExtras.map(({ productId, extraId }) => `${productId}:${extraId}`));
  for (const item of items) {
    if (!item.productId) continue;
    for (const extra of item.extras ?? []) {
      if (!validProductExtras.has(`${item.productId}:${extra.extraId}`)) {
        throw new ValidationError(`El extra ${extra.extraId} no pertenece al producto ${item.productId}.`);
      }
    }
  }
}

function priceProductItem(item: SaleItemInput & { productId: string }, catalog: SaleCatalog): PricedItem {
  const product = catalog.products.find((p) => p.id === item.productId)!;
  const availableTemperature = product.temperature ?? getDrinkTemperature(product.name, product.category?.name);
  if (item.size === 'JUMBO' && (!product.jumboPrice || !isJumboLatteProduct(product.name, product.category?.name))) {
    throw new ValidationError(`El tamaño Jumbo no está disponible para ${product.name}.`);
  }
  if (availableTemperature === 'BOTH' && !item.temperature) {
    throw new ValidationError(`Selecciona caliente o frío para ${product.name}.`);
  }
  // A 'BOTH' drink accepts either temperature; any other product only its own.
  if (item.temperature && availableTemperature !== 'BOTH' && item.temperature !== availableTemperature) {
    throw new ValidationError(`La temperatura seleccionada no está disponible para ${product.name}.`);
  }

  const unitPrice = item.size === 'JUMBO' ? product.jumboPrice! : product.price;
  const lineGross = unitPrice.mul(item.quantity);

  // An extra's quantity is per unit of the product: 2 lattes with "1 shot" carry 2 shots.
  // OrderItemExtra stores the line total (quantity × units), like costSnapshot (L-06).
  const extras: PricedExtra[] = (item.extras ?? []).map((extraInput) => {
    const extra = catalog.extras.find((e) => e.id === extraInput.extraId)!;
    const quantity = extraInput.quantity * item.quantity;
    return {
      extraId: extra.id,
      extraName: extra.name,
      quantity,
      unitPrice: extra.price,
      subtotal: extra.price.mul(quantity),
      costSnapshot: extra.cost.mul(quantity),
    };
  });

  const line: PricedLine = {
    productId: product.id,
    productName: item.size === 'JUMBO' ? `${product.name} Jumbo` : product.name,
    temperature: availableTemperature === 'BOTH' ? item.temperature ?? null : availableTemperature,
    quantity: new Prisma.Decimal(item.quantity),
    unitPrice,
    // Promotions are applied over the whole cart afterwards (applyCartPromotions).
    discount: ZERO,
    subtotal: lineGross,
    costSnapshot: product.cost.mul(item.quantity),
    notes: item.note,
    sourceComboId: null,
    extras,
  };

  const gross = lineGross.add(sum(extras.map((extra) => extra.subtotal)));
  return { lines: [line], gross, discount: ZERO, net: gross };
}

/**
 * Applies the promotions over every product line of the cart at once, so a 2x1 counts units
 * captured on different lines (hot and cold, with or without a note). Combos keep their price.
 */
function applyCartPromotions(items: SaleItemInput[], pricedItems: PricedItem[], catalog: SaleCatalog) {
  const productLines = pricedItems.flatMap((pricedItem, itemIndex) =>
    items[itemIndex].productId ? [{ pricedItem, line: pricedItem.lines[0], quantity: items[itemIndex].quantity }] : []);

  const discounts = calculateCartPromotions(
    productLines.map(({ line, quantity }) => ({
      unitPrice: line.unitPrice,
      quantity,
      product: catalog.products.find((product) => product.id === line.productId)!,
    })),
    catalog.promotions,
  );

  productLines.forEach(({ pricedItem, line }, index) => {
    const discount = discounts[index];
    line.discount = discount;
    line.subtotal = line.subtotal.sub(discount);
    pricedItem.discount = discount;
    pricedItem.net = pricedItem.gross.sub(discount);
  });
}

function priceComboItem(item: SaleItemInput & { comboId: string }, catalog: SaleCatalog): PricedItem {
  const combo = catalog.combos.find((c) => c.id === item.comboId)!;
  const comboTotalPrice = combo.price.mul(item.quantity);

  // L-05: split the combo price evenly across its products in whole cents; the last product
  // absorbs the rounding remainder, so the lines always add up to the combo price.
  const comboItemCount = combo.items.length || 1;
  const evenShare = comboTotalPrice.div(comboItemCount).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);

  const lines = combo.items.map((comboItem, index): PricedLine => {
    const quantity = comboItem.quantity.mul(item.quantity);
    const isLast = index === combo.items.length - 1;
    const lineSubtotal = isLast ? comboTotalPrice.sub(evenShare.mul(comboItemCount - 1)) : evenShare;
    return {
      productId: comboItem.productId,
      productName: `${comboItem.product.name} (Combo: ${combo.name})`,
      temperature: null,
      quantity,
      // Informational, rounded to cents: `subtotal` is the line's amount (unitPrice × quantity
      // may differ from it by a cent; reports must sum subtotals).
      unitPrice: lineSubtotal.div(quantity).toDecimalPlaces(2),
      // Combos already have their own price: promotions don't stack on them.
      discount: ZERO,
      subtotal: lineSubtotal,
      costSnapshot: comboItem.product.cost.mul(quantity),
      notes: item.note,
      sourceComboId: combo.id,
      extras: [],
    };
  });

  return { lines, gross: comboTotalPrice, discount: ZERO, net: comboTotalPrice };
}

export function priceSale(items: SaleItemInput[], catalog: SaleCatalog): PricedSale {
  assertCatalogCoversItems(items, catalog);

  const pricedItems = items.map((item) => {
    if (item.productId) return priceProductItem({ ...item, productId: item.productId }, catalog);
    if (item.comboId) return priceComboItem({ ...item, comboId: item.comboId }, catalog);
    // The validator already guarantees exactly one of productId/comboId.
    throw new ValidationError('Cada item debe contener exactamente un productId o comboId.');
  });
  applyCartPromotions(items, pricedItems, catalog);

  const subtotal = sum(pricedItems.map((item) => item.gross));
  const discount = sum(pricedItems.map((item) => item.discount));
  const totalCost = sum(pricedItems.flatMap((item) =>
    item.lines.flatMap((line) => [line.costSnapshot, ...line.extras.map((extra) => extra.costSnapshot)])));

  return {
    items: pricedItems,
    subtotal,
    discount,
    total: Prisma.Decimal.max(ZERO, subtotal.sub(discount)),
    totalCost,
  };
}
