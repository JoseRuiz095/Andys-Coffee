import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Prisma, type PromotionType } from "@prisma/client";
import { prisma } from "../src/config/prisma";

/**
 * Catalog exported from a real database by scripts/export-catalog.ts. When this file exists
 * the seed rebuilds the business catalog from it instead of the built-in sample catalog.
 */
export const CATALOG_FILE = resolve(process.cwd(), "prisma/seed-data/catalog.json");

type Nullable<T> = T | null;

export interface CatalogExport {
  exportedAt: string;
  units: { id: string; name: string; abbreviation: string }[];
  categories: { id: string; name: string; description: Nullable<string>; imageUrl: Nullable<string>; displayOrder: number; isActive: boolean }[];
  products: {
    id: string; categoryId: Nullable<string>; name: string; description: Nullable<string>; sku: string; imageUrl: Nullable<string>;
    price: string; cost: string; isActive: boolean; displayOrder: number;
  }[];
  ingredients: {
    id: string; name: string; sku: Nullable<string>; unitId: string; isActive: boolean;
    currentStock: string; minimumStock: string; averageCost: string;
  }[];
  recipes: { productId: string; ingredientId: string; quantity: string }[];
  extras: { id: string; name: string; description: Nullable<string>; price: string; cost: string; isActive: boolean }[];
  extraRecipes: { extraId: string; ingredientId: string; quantity: string }[];
  productExtras: { productId: string; extraId: string; isDefault: boolean }[];
  combos: {
    id: string; categoryId: Nullable<string>; name: string; description: Nullable<string>; price: string; cost: string;
    imageUrl: Nullable<string>; isActive: boolean; activeOnDays: number[]; displayOrder: number;
  }[];
  comboItems: { comboId: string; productId: string; quantity: string }[];
  promotions: {
    id: string; name: string; description: Nullable<string>; type: PromotionType; discountValue: string;
    buyQuantity: Nullable<number>; getQuantity: Nullable<number>; startDate: string; endDate: string;
    activeOnDays: number[]; isActive: boolean; productIds: string[]; categoryIds: string[];
  }[];
  suppliers: { id: string; name: string; phone: Nullable<string>; email: Nullable<string>; address: Nullable<string>; isActive: boolean }[];
  preferences: { key: string; value: string; type: string; label: Nullable<string>; description: Nullable<string> }[];
}

export function readCatalogExport(): CatalogExport | null {
  if (!existsSync(CATALOG_FILE)) return null;
  return JSON.parse(readFileSync(CATALOG_FILE, "utf-8")) as CatalogExport;
}

/**
 * Idempotent: every row is upserted by its exported id, so running the seed again updates
 * the catalog without duplicating it. Stock is only set when an ingredient is created — a
 * re-run never overwrites live stock — and it is recorded as an 'adjustment' movement
 * (referenceType 'initial_balance') so the movement history adds up to the stock.
 */
export async function seedCatalogFromExport(catalog: CatalogExport, adminUserId: string) {
  console.log(`Cargando catálogo exportado el ${catalog.exportedAt} (${CATALOG_FILE})...`);

  for (const unit of catalog.units) {
    await prisma.inventoryUnit.upsert({ where: { id: unit.id }, update: unit, create: unit });
  }

  for (const category of catalog.categories) {
    await prisma.category.upsert({ where: { id: category.id }, update: category, create: category });
  }

  for (const product of catalog.products) {
    await prisma.product.upsert({ where: { id: product.id }, update: product, create: product });
  }

  let initialBalances = 0;
  for (const { currentStock, averageCost, ...ingredient } of catalog.ingredients) {
    const existing = await prisma.ingredient.findUnique({ where: { id: ingredient.id }, select: { id: true } });
    if (existing) {
      await prisma.ingredient.update({ where: { id: ingredient.id }, data: ingredient });
      continue;
    }
    const stock = new Prisma.Decimal(currentStock);
    await prisma.$transaction(async (tx) => {
      await tx.ingredient.create({ data: { ...ingredient, currentStock: stock, averageCost } });
      if (!stock.isZero()) {
        await tx.inventoryMovement.create({
          data: {
            ingredientId: ingredient.id,
            type: "adjustment",
            quantity: stock,
            unitCost: averageCost,
            referenceType: "initial_balance",
            notes: `Saldo inicial al recargar el catálogo (${catalog.exportedAt.slice(0, 10)})`,
            createdById: adminUserId,
          },
        });
      }
    });
    if (!stock.isZero()) initialBalances += 1;
  }

  for (const recipe of catalog.recipes) {
    await prisma.recipe.upsert({
      where: { productId_ingredientId: { productId: recipe.productId, ingredientId: recipe.ingredientId } },
      update: { quantity: recipe.quantity },
      create: recipe,
    });
  }

  for (const extra of catalog.extras) {
    await prisma.extra.upsert({ where: { id: extra.id }, update: extra, create: extra });
  }
  for (const recipe of catalog.extraRecipes) {
    await prisma.extraRecipe.upsert({
      where: { extraId_ingredientId: { extraId: recipe.extraId, ingredientId: recipe.ingredientId } },
      update: { quantity: recipe.quantity },
      create: recipe,
    });
  }
  for (const link of catalog.productExtras) {
    await prisma.productExtra.upsert({
      where: { productId_extraId: { productId: link.productId, extraId: link.extraId } },
      update: { isDefault: link.isDefault },
      create: link,
    });
  }

  for (const combo of catalog.combos) {
    await prisma.combo.upsert({ where: { id: combo.id }, update: combo, create: combo });
  }
  for (const item of catalog.comboItems) {
    await prisma.comboItem.upsert({
      where: { comboId_productId: { comboId: item.comboId, productId: item.productId } },
      update: { quantity: item.quantity },
      create: item,
    });
  }

  for (const { productIds, categoryIds, ...promotion } of catalog.promotions) {
    const data = { ...promotion, startDate: new Date(promotion.startDate), endDate: new Date(promotion.endDate) };
    const links = {
      products: { create: productIds.map((productId) => ({ productId })) },
      categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
    };
    await prisma.promotion.upsert({
      where: { id: promotion.id },
      update: { ...data, products: { deleteMany: {}, ...links.products }, categories: { deleteMany: {}, ...links.categories } },
      create: { ...data, ...links },
    });
  }

  for (const supplier of catalog.suppliers) {
    await prisma.supplier.upsert({ where: { id: supplier.id }, update: supplier, create: supplier });
  }

  // update: {} — a re-run must not overwrite settings an admin changed afterwards.
  for (const preference of catalog.preferences) {
    await prisma.systemPreference.upsert({ where: { key: preference.key }, update: {}, create: preference });
  }

  console.log(
    `Catálogo cargado: ${catalog.products.length} productos, ${catalog.ingredients.length} ingredientes ` +
    `(${initialBalances} con saldo inicial nuevo), ${catalog.recipes.length} recetas, ${catalog.suppliers.length} proveedores.`,
  );
}
