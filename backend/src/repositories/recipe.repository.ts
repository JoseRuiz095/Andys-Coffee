import type { DrinkTemperature, Prisma, ProductSize } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { DbClient, Tx } from './transaction';

const recipeLineSelect = {
  ingredientId: true,
  quantity: true,
  ingredient: {
    select: {
      name: true,
      sku: true,
      averageCost: true,
      isActive: true,
      unit: { select: { id: true, abbreviation: true } },
    },
  },
} satisfies Prisma.RecipeSelect;

export const RecipeRepository = {
  /** Ingredients referenced by a recipe, with their unit (to validate and convert). */
  async findIngredientsForRecipe(ids: string[], client: DbClient = prisma) {
    return client.ingredient.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, name: true, isActive: true, unit: { select: { id: true, abbreviation: true, dimension: true, factor: true } } },
    });
  },

  async findUnits(ids: string[], client: DbClient = prisma) {
    return client.inventoryUnit.findMany({
      where: { id: { in: ids } },
      select: { id: true, abbreviation: true, dimension: true, factor: true },
    });
  },

  async findProductRecipe(productId: string, client: DbClient = prisma) {
    return client.recipe.findMany({
      where: { productId },
      select: { ...recipeLineSelect, size: true, temperature: true },
      orderBy: [{ temperature: 'asc' }, { ingredient: { name: 'asc' } }],
    });
  },

  async findExtraRecipe(extraId: string, client: DbClient = prisma) {
    return client.extraRecipe.findMany({
      where: { extraId },
      select: recipeLineSelect,
      orderBy: { ingredient: { name: 'asc' } },
    });
  },

  async replaceProductRecipe(
    tx: Tx,
    productId: string,
    size: ProductSize,
    lines: { ingredientId: string; quantity: Prisma.Decimal; temperature?: DrinkTemperature }[],
  ) {
    await tx.recipe.deleteMany({ where: { productId, size } });
    if (lines.length > 0) {
      await tx.recipe.createMany({ data: lines.map((line) => ({ productId, size, ...line })) });
    }
  },

  async replaceExtraRecipe(tx: Tx, extraId: string, lines: { ingredientId: string; quantity: Prisma.Decimal }[]) {
    await tx.extraRecipe.deleteMany({ where: { extraId } });
    if (lines.length > 0) {
      await tx.extraRecipe.createMany({ data: lines.map((line) => ({ extraId, ...line })) });
    }
  },

  /** Recipes a sale needs: per product (and size) and per extra, in base units. */
  async findRecipesForSale(tx: Tx, productIds: string[], extraIds: string[]) {
    const [products, extras] = await Promise.all([
      tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          tracksInventory: true,
          temperature: true,
          recipes: { select: { size: true, temperature: true, ingredientId: true, quantity: true } },
        },
      }),
      extraIds.length === 0
        ? Promise.resolve([])
        : tx.extra.findMany({
          where: { id: { in: extraIds } },
          select: { id: true, recipes: { select: { ingredientId: true, quantity: true } } },
        }),
    ]);
    return { products, extras };
  },

  /**
   * Active products that consume inventory but can't be costed or consumed: no REGULAR recipe,
   * or a beverage with a Jumbo price and no JUMBO recipe.
   */
  /** Active products with a recipe, with the current stock of each ingredient (coverage). */
  async findProductsWithRecipeStock(client: DbClient = prisma) {
    return client.product.findMany({
      where: { isActive: true, recipes: { some: {} } },
      select: {
        id: true,
        name: true,
        temperature: true,
        category: { select: { name: true } },
        recipes: {
          select: {
            size: true,
            temperature: true,
            quantity: true,
            ingredient: { select: { id: true, name: true, currentStock: true, unit: { select: { abbreviation: true } } } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  },

  async findProductsMissingRecipe(client: DbClient = prisma) {
    return client.product.findMany({
      where: {
        isActive: true,
        tracksInventory: true,
        OR: [
          { recipes: { none: { size: 'REGULAR' } } },
          { jumboPrice: { not: null }, category: { isBeverage: true }, recipes: { none: { size: 'JUMBO' } } },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        jumboPrice: true,
        category: { select: { name: true, isBeverage: true } },
        recipes: { select: { size: true }, distinct: ['size'] },
      },
      orderBy: { name: 'asc' },
    });
  },
};
