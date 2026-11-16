import { OrderStatus, Prisma, type DrinkTemperature, type ProductSize } from '@prisma/client';
import { InventoryRepository } from '../repositories/inventory.repository';
import { OrderRepository } from '../repositories/order.repository';
import { PreferenceRepository } from '../repositories/preference.repository';
import { RecipeRepository } from '../repositories/recipe.repository';
import type { DbClient, Tx } from '../repositories/transaction';

/**
 * Recipe-based inventory consumption (docs/Project/plan-inventario-tiempo-real.md, F5).
 *
 * D-1: a sale never fails for lack of stock; an ingredient may go negative.
 * D-2: ingredients are consumed when the order is created, in the sale's own transaction.
 * D-3: each line consumes the recipe of its size (Jumbo falls back to the regular recipe).
 * Temperature (2026-11-16): within that size, the lines marked BOTH plus those of the line's
 * temperature (a hot Latte uses the hot cup and no ice; a cold one, the cold cup and ice).
 * Rollout: only while the system preference inventory.consumeOnSale is "true".
 */

export const CONSUME_ON_SALE_KEY = 'inventory.consumeOnSale';

const ZERO = new Prisma.Decimal(0);

type RecipeLine = { ingredientId: string; quantity: Prisma.Decimal };

export interface SaleLineForConsumption {
  orderItemId: string;
  productId: string;
  size: ProductSize;
  /** HOT/COLD chosen for a product sold both ways; null when the product has one temperature. */
  temperature: DrinkTemperature | null;
  /** Units sold on the line. */
  quantity: Prisma.Decimal;
  /** Extras of the line; `quantity` is already the line total (per-unit × units). */
  extras: { extraId: string | null; quantity: Prisma.Decimal }[];
}

export interface RecipesForSale {
  products: {
    id: string;
    tracksInventory: boolean;
    temperature: DrinkTemperature | null;
    recipes: (RecipeLine & { size: ProductSize; temperature: DrinkTemperature })[];
  }[];
  extras: { id: string; recipes: RecipeLine[] }[];
}

export interface Consumption {
  orderItemId: string;
  ingredientId: string;
  /** Positive amount consumed, in the ingredient's base unit. */
  quantity: Prisma.Decimal;
}

/**
 * What each order line consumes, per ingredient. Pure: no database access.
 * Extras add (or, when negative, subtract: "sin azúcar", substitutions) to the line, and the
 * net of a line never goes below zero for an ingredient.
 */
export function computeConsumption(lines: SaleLineForConsumption[], recipes: RecipesForSale): Consumption[] {
  const products = new Map(recipes.products.map((product) => [product.id, product]));
  const extras = new Map(recipes.extras.map((extra) => [extra.id, extra.recipes]));
  const result: Consumption[] = [];

  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product?.tracksInventory) continue;

    const ofSize = product.recipes.filter((recipe) => recipe.size === line.size);
    const sized = ofSize.length > 0 ? ofSize : product.recipes.filter((recipe) => recipe.size === 'REGULAR');
    // The line's temperature, else the product's own; a "both ways" sale without it uses HOT.
    const temperature: DrinkTemperature = line.temperature && line.temperature !== 'BOTH'
      ? line.temperature
      : product.temperature === 'COLD' ? 'COLD' : 'HOT';
    const recipe = sized.filter((item) => item.temperature === 'BOTH' || item.temperature === temperature);

    const net = new Map<string, Prisma.Decimal>();
    const add = (ingredientId: string, amount: Prisma.Decimal) =>
      net.set(ingredientId, (net.get(ingredientId) ?? ZERO).add(amount));

    for (const item of recipe) add(item.ingredientId, item.quantity.mul(line.quantity));
    for (const extra of line.extras) {
      if (!extra.extraId) continue;
      for (const item of extras.get(extra.extraId) ?? []) add(item.ingredientId, item.quantity.mul(extra.quantity));
    }

    for (const [ingredientId, quantity] of net) {
      const consumed = quantity.toDecimalPlaces(4);
      if (consumed.gt(0)) result.push({ orderItemId: line.orderItemId, ingredientId, quantity: consumed });
    }
  }
  return result;
}

/** Ingredient whose stock crossed its minimum (or ran out) with this movement batch. */
export interface StockCrossing {
  ingredientId: string;
  name: string;
  unit: string;
  before: Prisma.Decimal;
  after: Prisma.Decimal;
  minimumStock: Prisma.Decimal;
}

/** True when the stock went from above the minimum to at/below it, or from positive to ≤ 0. */
export function crossedThreshold(before: Prisma.Decimal, after: Prisma.Decimal, minimum: Prisma.Decimal) {
  return (before.gt(minimum) && after.lte(minimum)) || (before.gt(0) && after.lte(0));
}

export async function isConsumeOnSaleEnabled(client?: DbClient) {
  const preference = await PreferenceRepository.findByKey(CONSUME_ON_SALE_KEY, client);
  return preference?.value === 'true';
}

/**
 * Applies signed stock changes in ingredient-id order (so concurrent sales lock rows in the same
 * order and don't deadlock) and returns, per ingredient, the stock before and after.
 */
async function applyDeltas(tx: Tx, deltas: Map<string, Prisma.Decimal>) {
  const results = new Map<string, Awaited<ReturnType<typeof InventoryRepository.updateStock>> & { before: Prisma.Decimal }>();
  for (const ingredientId of [...deltas.keys()].sort()) {
    const delta = deltas.get(ingredientId)!;
    const updated = await InventoryRepository.updateStock(ingredientId, delta, tx);
    results.set(ingredientId, { ...updated, before: updated.currentStock.sub(delta) });
  }
  return results;
}

function crossingsOf(results: Awaited<ReturnType<typeof applyDeltas>>): StockCrossing[] {
  return [...results.values()]
    .filter((row) => crossedThreshold(row.before, row.currentStock, row.minimumStock))
    .map((row) => ({
      ingredientId: row.id,
      name: row.name,
      unit: row.unit.abbreviation,
      before: row.before,
      after: row.currentStock,
      minimumStock: row.minimumStock,
    }));
}

export const InventoryConsumptionService = {
  /**
   * Consumes the ingredients of a just-created order (inside its transaction). Does nothing
   * while consumption is off. Returns the ingredients that crossed their minimum, for alerts
   * dispatched after the commit.
   */
  async consumeForOrder(
    tx: Tx,
    order: { id: string; orderNumber: bigint },
    lines: SaleLineForConsumption[],
    userId: string,
  ): Promise<StockCrossing[]> {
    if (lines.length === 0 || !(await isConsumeOnSaleEnabled(tx))) return [];

    const productIds = [...new Set(lines.map((line) => line.productId))];
    const extraIds = [...new Set(lines.flatMap((line) => line.extras.flatMap(({ extraId }) => (extraId ? [extraId] : []))))];
    const recipes = await RecipeRepository.findRecipesForSale(tx, productIds, extraIds);
    const consumption = computeConsumption(lines, recipes);
    if (consumption.length === 0) return [];

    const deltas = new Map<string, Prisma.Decimal>();
    for (const item of consumption) {
      deltas.set(item.ingredientId, (deltas.get(item.ingredientId) ?? ZERO).sub(item.quantity));
    }
    const results = await applyDeltas(tx, deltas);

    // Balance after each movement: walk each ingredient's lines from its stock before the sale.
    const running = new Map([...results].map(([id, row]) => [id, row.before]));
    const movements: Prisma.InventoryMovementCreateManyInput[] = consumption.map((item) => {
      const balance = running.get(item.ingredientId)!.sub(item.quantity);
      running.set(item.ingredientId, balance);
      return {
        ingredientId: item.ingredientId,
        type: 'sale',
        quantity: item.quantity.negated(),
        unitCost: results.get(item.ingredientId)!.averageCost,
        referenceType: 'order',
        referenceId: order.id,
        orderItemId: item.orderItemId,
        balanceAfter: balance,
        notes: `Venta #${order.orderNumber.toString()}`,
        createdById: userId,
      };
    });
    await InventoryRepository.createMovements(movements, tx);
    await OrderRepository.markInventoryProcessed(tx, order.id);
    return crossingsOf(results);
  },

  /**
   * Gives back what a cancelled sale consumed, from its recorded movements (never from the
   * current recipe, which may have changed). Only one cancellation can claim it.
   * An order cancelled before preparation ('pending') returns its ingredients to stock; once
   * prepared, they were used: the reversal is followed by a waste exit, so the stock stays as is
   * but reports show the loss as waste instead of as sales consumption.
   */
  async reverseForOrder(
    tx: Tx,
    order: { id: string; orderNumber: bigint; status: OrderStatus },
    userId: string,
  ): Promise<{ reversed: boolean; crossings: StockCrossing[] }> {
    if (!(await OrderRepository.claimInventoryReversal(tx, order.id))) return { reversed: false, crossings: [] };

    const sales = await InventoryRepository.findSaleMovementsForOrder(tx, order.id);
    const prepared = order.status !== OrderStatus.pending;
    const label = `Venta #${order.orderNumber.toString()} cancelada`;

    const returned = new Map<string, Prisma.Decimal>();
    for (const sale of sales) returned.set(sale.ingredientId, (returned.get(sale.ingredientId) ?? ZERO).sub(sale.quantity));
    const results = await applyDeltas(tx, returned);
    // Prepared orders: the same amounts leave again as waste.
    const wasted = prepared ? await applyDeltas(tx, new Map([...returned].map(([id, amount]) => [id, amount.negated()]))) : null;

    const running = new Map([...results].map(([id, row]) => [id, row.before]));
    const movements: Prisma.InventoryMovementCreateManyInput[] = [];
    for (const sale of sales) {
      const amount = sale.quantity.negated();
      const balance = running.get(sale.ingredientId)!.add(amount);
      running.set(sale.ingredientId, balance);
      movements.push({
        ingredientId: sale.ingredientId,
        type: 'sale_reversal',
        quantity: amount,
        unitCost: sale.unitCost,
        referenceType: 'order_cancellation',
        referenceId: order.id,
        orderItemId: sale.orderItemId,
        balanceAfter: balance,
        notes: label,
        createdById: userId,
      });
    }
    if (wasted) {
      for (const sale of sales) {
        const balance = running.get(sale.ingredientId)!.add(sale.quantity);
        running.set(sale.ingredientId, balance);
        movements.push({
          ingredientId: sale.ingredientId,
          type: 'exit',
          reason: 'waste',
          quantity: sale.quantity,
          unitCost: sale.unitCost,
          referenceType: 'order_cancellation',
          referenceId: order.id,
          orderItemId: sale.orderItemId,
          balanceAfter: balance,
          notes: `${label} ya preparada: merma`,
          createdById: userId,
        });
      }
    }
    await InventoryRepository.createMovements(movements, tx);
    return { reversed: true, crossings: wasted ? [] : crossingsOf(results) };
  },
};
