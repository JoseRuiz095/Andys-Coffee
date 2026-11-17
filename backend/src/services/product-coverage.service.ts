import type { DrinkTemperature, Prisma, ProductSize } from '@prisma/client';
import { RecipeRepository } from '../repositories/recipe.repository';
import { AuthorizationError } from '../utils/errors';
import type { AuthUser } from './auth.service';

/** One recipe line as read from the database. */
export interface CoverageRecipeLine {
  size: ProductSize;
  temperature: DrinkTemperature;
  quantity: Prisma.Decimal;
  ingredient: { id: string; name: string; currentStock: Prisma.Decimal; unit: { abbreviation: string } };
}

export interface CoverageLine {
  ingredientId: string;
  name: string;
  unit: string;
  /** Per unit sold, in the ingredient's base unit. */
  quantity: number;
  currentStock: number;
  /** Whole units this ingredient alone covers (0 when out of stock or negative). */
  units: number;
}

export interface CoverageVariant {
  size: ProductSize;
  /** null when the recipe does not depend on the temperature. */
  temperature: Exclude<DrinkTemperature, 'BOTH'> | null;
  /** Whole units the stock covers: the lowest of its lines. */
  units: number;
  /** Ingredients that set that limit. */
  limitingIngredientIds: string[];
  lines: CoverageLine[];
}

/**
 * How many units of a product the current stock covers, per size and temperature. BOTH lines
 * apply to every temperature; HOT/COLD lines only to theirs (same rule as the sale), so a latte
 * sold hot and cold gets one variant per temperature.
 */
export function recipeCoverage(recipes: CoverageRecipeLine[]): CoverageVariant[] {
  const sizes = (['REGULAR', 'JUMBO'] as const).filter((size) => recipes.some((line) => line.size === size));
  const byTemperature = recipes.some((line) => line.temperature !== 'BOTH');
  const temperatures = byTemperature ? (['HOT', 'COLD'] as const) : [null];

  const variants: CoverageVariant[] = [];
  for (const size of sizes) {
    for (const temperature of temperatures) {
      const lines = recipes
        .filter((line) => line.size === size && (line.temperature === 'BOTH' || line.temperature === temperature))
        .map((line): CoverageLine => {
          const quantity = Number(line.quantity);
          const currentStock = Number(line.ingredient.currentStock);
          return {
            ingredientId: line.ingredient.id,
            name: line.ingredient.name,
            unit: line.ingredient.unit.abbreviation,
            quantity,
            currentStock,
            units: currentStock > 0 && quantity > 0 ? Math.floor(currentStock / quantity + 1e-9) : 0,
          };
        })
        .sort((a, b) => a.units - b.units || a.name.localeCompare(b.name, 'es'));
      if (lines.length === 0) continue;
      const units = Math.min(...lines.map((line) => line.units));
      variants.push({
        size,
        temperature,
        units,
        limitingIngredientIds: lines.filter((line) => line.units === units).map((line) => line.ingredientId),
        lines,
      });
    }
  }
  return variants;
}

export const ProductCoverageService = {
  /** Active products with a recipe and how many units the stock covers, the shortest first. */
  async list(user: AuthUser) {
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver el inventario.');
    }
    const products = await RecipeRepository.findProductsWithRecipeStock();
    return products
      .map((product) => {
        const variants = recipeCoverage(product.recipes);
        return {
          id: product.id,
          name: product.name,
          category: product.category?.name ?? null,
          // The variant that runs out first.
          units: variants.length > 0 ? Math.min(...variants.map((variant) => variant.units)) : 0,
          variants,
        };
      })
      .sort((a, b) => a.units - b.units || a.name.localeCompare(b.name, 'es'));
  },
};
