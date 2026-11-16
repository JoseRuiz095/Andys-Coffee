import { Prisma, type DrinkTemperature, type ProductSize } from '@prisma/client';
import { RecipeRepository } from '../repositories/recipe.repository';
import type { DbClient, Tx } from '../repositories/transaction';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuthorizationError, ValidationError } from '../utils/errors';
import type { AuthUser } from './auth.service';
import type { ProductRecipeInput, RecipeLineInput } from '../validators/recipe.validator';

export const MANAGE_RECIPES_PERMISSION = 'inventory.manage_recipes';

export type ResolvedLine = { ingredientId: string; quantity: Prisma.Decimal; temperature?: DrinkTemperature };
export type ResolvedProductRecipe = Record<ProductSize, ResolvedLine[]>;

export function ensureCanManageRecipes(user: AuthUser) {
  if (!user.permissions?.includes(MANAGE_RECIPES_PERMISSION)) {
    throw new AuthorizationError('No tienes permiso para editar recetas.');
  }
}

/**
 * Validates recipe lines (ingredients exist and are active, the capture unit measures the same
 * thing) and converts every quantity to the ingredient's base unit: 1 kg of an ingredient
 * stocked in gr is stored as 1000.
 */
export async function resolveRecipeLines(
  lines: (RecipeLineInput & { temperature?: DrinkTemperature })[],
  client: DbClient,
): Promise<ResolvedLine[]> {
  if (lines.length === 0) return [];
  const ingredientIds = [...new Set(lines.map(({ ingredientId }) => ingredientId))];
  const unitIds = [...new Set(lines.flatMap(({ unitId }) => (unitId ? [unitId] : [])))];
  const [ingredients, units] = await Promise.all([
    RecipeRepository.findIngredientsForRecipe(ingredientIds, client),
    RecipeRepository.findUnits(unitIds, client),
  ]);
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const unitById = new Map(units.map((unit) => [unit.id, unit]));

  return lines.map((line) => {
    const ingredient = ingredientById.get(line.ingredientId);
    if (!ingredient) throw new ValidationError(`El ingrediente ${line.ingredientId} no existe.`);
    if (!ingredient.isActive) throw new ValidationError(`El ingrediente "${ingredient.name}" está inactivo.`);

    let quantity = new Prisma.Decimal(line.quantity);
    if (line.unitId && line.unitId !== ingredient.unit.id) {
      const unit = unitById.get(line.unitId);
      if (!unit) throw new ValidationError(`La unidad ${line.unitId} no existe.`);
      if (unit.dimension !== ingredient.unit.dimension) {
        throw new ValidationError(
          `"${ingredient.name}" se mide en ${ingredient.unit.abbreviation}; no se puede capturar en ${unit.abbreviation}.`,
        );
      }
      quantity = quantity.mul(unit.factor).div(ingredient.unit.factor);
    }
    quantity = quantity.toDecimalPlaces(4);
    if (quantity.isZero()) {
      throw new ValidationError(`La cantidad de "${ingredient.name}" es demasiado pequeña (mínimo 0.0001 ${ingredient.unit.abbreviation}).`);
    }
    return { ingredientId: ingredient.id, quantity, ...(line.temperature && { temperature: line.temperature }) };
  });
}

export async function resolveProductRecipe(recipe: ProductRecipeInput, client: DbClient): Promise<ResolvedProductRecipe> {
  return {
    REGULAR: await resolveRecipeLines(recipe.REGULAR, client),
    JUMBO: await resolveRecipeLines(recipe.JUMBO ?? [], client),
  };
}

/**
 * Decision D-5: a product that consumes inventory needs its recipe, and a beverage sold in
 * Jumbo needs the Jumbo recipe too. Only Jumbo-capable products may have a Jumbo recipe.
 */
export function assertProductRecipeRules(params: {
  tracksInventory: boolean;
  isActive: boolean;
  jumboAvailable: boolean;
  regularLines: number;
  jumboLines: number;
  /** The product is sold hot and cold (temperature BOTH). */
  soldBothWays?: boolean;
  /** Lines marked HOT or COLD. */
  temperatureLines?: number;
}) {
  const { tracksInventory, isActive, jumboAvailable, regularLines, jumboLines, soldBothWays = false, temperatureLines = 0 } = params;
  if (!jumboAvailable && jumboLines > 0) {
    throw new ValidationError('Sólo las bebidas con precio Jumbo tienen receta Jumbo.');
  }
  if (!soldBothWays && temperatureLines > 0) {
    throw new ValidationError('Solo los productos que se venden fríos y calientes tienen ingredientes por temperatura.');
  }
  if (!tracksInventory || !isActive) return;
  if (regularLines === 0) {
    throw new ValidationError(
      'Captura la receta del producto (ingredientes y cantidades) o márcalo como "No controla inventario".',
    );
  }
  if (jumboAvailable && jumboLines === 0) {
    throw new ValidationError('El producto tiene precio Jumbo: captura también la receta Jumbo.');
  }
}

type StoredLine = Awaited<ReturnType<typeof RecipeRepository.findExtraRecipe>>[number];

/** Recipe lines as the API returns them: numbers, ingredient name/unit and cost per line. */
export function presentRecipeLines(lines: StoredLine[]) {
  const presented = lines.map((line) => {
    const lineCost = line.quantity.mul(line.ingredient.averageCost);
    return {
      ingredientId: line.ingredientId,
      ingredientName: line.ingredient.name,
      ingredientSku: line.ingredient.sku,
      ingredientActive: line.ingredient.isActive,
      ...('temperature' in line && { temperature: (line as StoredLine & { temperature: DrinkTemperature }).temperature }),
      unitId: line.ingredient.unit.id,
      unit: line.ingredient.unit.abbreviation,
      quantity: line.quantity.toNumber(),
      averageCost: line.ingredient.averageCost.toNumber(),
      lineCost: lineCost.toDecimalPlaces(4).toNumber(),
    };
  });
  const cost = lines
    .reduce((total, line) => total.add(line.quantity.mul(line.ingredient.averageCost)), new Prisma.Decimal(0))
    .toDecimalPlaces(2)
    .toNumber();
  return { lines: presented, cost };
}

export const RecipeService = {
  async getProductRecipe(productId: string, client?: DbClient) {
    const lines = await RecipeRepository.findProductRecipe(productId, client);
    // A product sold hot and cold never consumes both versions: its cost is the hot one
    // (lines BOTH + HOT), with the cold one alongside. All lines are still listed.
    const present = (size: ProductSize) => {
      const ofSize = lines.filter((line) => line.size === size);
      const summary = presentRecipeLines(ofSize);
      if (!ofSize.some(({ temperature }) => temperature !== 'BOTH')) return summary;
      const costOf = (temperature: DrinkTemperature) =>
        presentRecipeLines(ofSize.filter((line) => line.temperature === 'BOTH' || line.temperature === temperature)).cost;
      return { ...summary, cost: costOf('HOT'), hotCost: costOf('HOT'), coldCost: costOf('COLD') };
    };
    return { REGULAR: present('REGULAR'), JUMBO: present('JUMBO') };
  },

  async getExtraRecipe(extraId: string, client?: DbClient) {
    return presentRecipeLines(await RecipeRepository.findExtraRecipe(extraId, client));
  },

  /** Replaces both sizes of a product's recipe and records the change in the audit log. */
  async replaceProductRecipe(tx: Tx, productId: string, recipe: ResolvedProductRecipe, user: AuthUser) {
    const before = await RecipeRepository.findProductRecipe(productId, tx);
    for (const size of ['REGULAR', 'JUMBO'] as const) {
      await RecipeRepository.replaceProductRecipe(tx, productId, size, recipe[size]);
    }
    await AuditLogRepository.create({
      userId: user.id,
      action: 'RECIPE_UPDATED',
      metadata: {
        productId,
        before: before.map(({ size, temperature, ingredientId, quantity }) => ({ size, temperature, ingredientId, quantity: quantity.toString() })),
        after: (['REGULAR', 'JUMBO'] as const).flatMap((size) =>
          recipe[size].map(({ ingredientId, quantity, temperature = 'BOTH' }) => ({ size, temperature, ingredientId, quantity: quantity.toString() }))),
      },
    }, tx);
  },

  async replaceExtraRecipe(tx: Tx, extraId: string, lines: ResolvedLine[], user: AuthUser) {
    const before = await RecipeRepository.findExtraRecipe(extraId, tx);
    await RecipeRepository.replaceExtraRecipe(tx, extraId, lines);
    await AuditLogRepository.create({
      userId: user.id,
      action: 'RECIPE_UPDATED',
      metadata: {
        extraId,
        before: before.map(({ ingredientId, quantity }) => ({ ingredientId, quantity: quantity.toString() })),
        after: lines.map(({ ingredientId, quantity }) => ({ ingredientId, quantity: quantity.toString() })),
      },
    }, tx);
  },

  /** Active products that consume inventory but miss a recipe (blocks turning consumption on). */
  async findProductsMissingRecipe() {
    const products = await RecipeRepository.findProductsMissingRecipe();
    return products.map((product) => {
      const sizes = new Set(product.recipes.map(({ size }) => size));
      const missing: ProductSize[] = [];
      if (!sizes.has('REGULAR')) missing.push('REGULAR');
      if (product.jumboPrice !== null && product.category?.isBeverage && !sizes.has('JUMBO')) missing.push('JUMBO');
      return { id: product.id, name: product.name, sku: product.sku, category: product.category?.name ?? null, missing };
    });
  },
};
