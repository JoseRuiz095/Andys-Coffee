import { ReplenishmentRepository } from '../repositories/replenishment.repository';
import { AuthorizationError } from '../utils/errors';
import type { AuthUser } from './auth.service';

/** Days of stock below which an ingredient is suggested even above its minimum. */
export const LOW_COVERAGE_DAYS = 3;
/** When the target is already met but stock runs out soon, buy this many days of consumption. */
const COVERAGE_PURCHASE_DAYS = 7;

const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

/**
 * Restock suggestion for one ingredient (plan F7). Pure.
 * - Daily consumption = net consumption of the period ÷ days.
 * - Target = maximum stock, or 2 × minimum when there is none.
 * - Suggested when the stock is at/below the minimum or covers less than LOW_COVERAGE_DAYS;
 *   quantity = what reaches the target (a week of consumption when the target is already met),
 *   never above the maximum stock.
 */
export function suggestReplenishment(input: {
  current: number;
  minimum: number;
  maximum: number | null;
  consumed: number;
  days: number;
}) {
  const dailyConsumption = input.consumed > 0 ? input.consumed / input.days : 0;
  const coverageDays = dailyConsumption > 0 ? Math.max(0, input.current) / dailyConsumption : null;
  const target = input.maximum ?? input.minimum * 2;
  const needed = (input.current <= input.minimum && input.minimum > 0)
    || (input.current <= 0 && dailyConsumption > 0)
    || (coverageDays !== null && coverageDays < LOW_COVERAGE_DAYS);
  // Up to the target; when the target is already met but stock runs out soon, a week of
  // consumption. The maximum stock, when set, is never exceeded.
  const toTarget = target - input.current;
  const raw = toTarget > 0 ? toTarget : dailyConsumption * COVERAGE_PURCHASE_DAYS - input.current;
  const capped = input.maximum !== null ? Math.min(raw, input.maximum - input.current) : raw;
  const suggested = needed ? Math.max(0, capped) : 0;
  return {
    dailyConsumption: round(dailyConsumption, 4),
    coverageDays: coverageDays === null ? null : round(coverageDays, 1),
    target: round(target, 4),
    needed,
    suggestedQuantity: round(Math.ceil(suggested * 100) / 100),
  };
}

export const ReplenishmentService = {
  /** Ingredients to restock, most urgent first (lowest coverage, then most below the minimum). */
  async getSuggestions(days: number, user: AuthUser) {
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver el inventario.');
    }
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [ingredients, consumption] = await Promise.all([
      ReplenishmentRepository.findActiveIngredients(),
      ReplenishmentRepository.sumConsumptionSince(since),
    ]);

    const rows = ingredients.map((ingredient) => {
      const net = consumption.get(ingredient.id);
      const suggestion = suggestReplenishment({
        current: ingredient.currentStock.toNumber(),
        minimum: ingredient.minimumStock.toNumber(),
        maximum: ingredient.maximumStock?.toNumber() ?? null,
        consumed: net ? -net.toNumber() : 0,
        days,
      });
      return { ingredient, suggestion };
    }).filter(({ suggestion }) => suggestion.needed && suggestion.suggestedQuantity > 0);

    const lastPurchases = await ReplenishmentRepository.findLastPurchases(rows.map(({ ingredient }) => ingredient.id));
    return rows
      .map(({ ingredient, suggestion }) => {
        const last = lastPurchases.get(ingredient.id);
        const unitCost = last ? last.unitCost.toNumber() : ingredient.averageCost.toNumber();
        return {
          ingredientId: ingredient.id,
          name: ingredient.name,
          sku: ingredient.sku,
          unit: ingredient.unit.abbreviation,
          currentStock: ingredient.currentStock.toNumber(),
          minimumStock: ingredient.minimumStock.toNumber(),
          maximumStock: ingredient.maximumStock?.toNumber() ?? null,
          ...suggestion,
          lastSupplier: last?.purchase.supplier ?? null,
          lastPurchasedAt: last?.purchase.purchasedAt ?? null,
          unitCost,
          estimatedCost: round(unitCost * suggestion.suggestedQuantity),
        };
      })
      .sort((a, b) => (a.coverageDays ?? Infinity) - (b.coverageDays ?? Infinity)
        || (a.currentStock - a.minimumStock) - (b.currentStock - b.minimumStock));
  },
};
