/**
 * Exports the catalog of the database in .env.<NODE_ENV> (`npm run catalog:export` or
 * `npm run catalog:export:prod`) to prisma/seed-data/catalog.json so the seed
 * can rebuild it on a clean database. READ-ONLY: it only runs SELECTs.
 *
 *   cd backend && npm run catalog:export:prod
 *
 * Exported: inventory units, categories, products, ingredients (with current stock, minimum
 * and average cost), recipes, extras (+ recipes and product links), combos (+ items),
 * promotions (+ linked products/categories), suppliers and system preferences.
 * Not exported (operational history): orders, payments, cash sessions/movements, expenses,
 * purchases, inventory movements, physical counts, notifications, snapshots, users.
 *
 * IDs are kept so every reference (recipes, combos, promotions) survives the reload.
 * Soft-deleted ingredients (deletedAt) are left out.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../src/config/prisma';

const decimal = (value: { toString(): string }) => value.toString();

async function main() {
  const host = (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '').replace(/\/\/[^@]*@/, '//***@');
  process.stdout.write(`Exportando catálogo de: ${host}\n`);

  const [units, categories, products, ingredients, recipes, extras, extraRecipes, productExtras, combos, comboItems, promotions, suppliers, preferences] =
    await Promise.all([
      prisma.inventoryUnit.findMany({ orderBy: { name: 'asc' } }),
      prisma.category.findMany({ orderBy: { displayOrder: 'asc' } }),
      prisma.product.findMany({ orderBy: [{ categoryId: 'asc' }, { displayOrder: 'asc' }] }),
      prisma.ingredient.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
      prisma.recipe.findMany(),
      prisma.extra.findMany({ orderBy: { name: 'asc' } }),
      prisma.extraRecipe.findMany(),
      prisma.productExtra.findMany(),
      prisma.combo.findMany({ orderBy: { displayOrder: 'asc' } }),
      prisma.comboItem.findMany(),
      prisma.promotion.findMany({ include: { products: true, categories: true }, orderBy: { name: 'asc' } }),
      prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
      prisma.systemPreference.findMany({ orderBy: { key: 'asc' } }),
    ]);

  const ingredientIds = new Set(ingredients.map((i) => i.id));
  const skipped = [...recipes, ...extraRecipes].filter((r) => !ingredientIds.has(r.ingredientId)).length;

  const catalog = {
    exportedAt: new Date().toISOString(),
    units: units.map(({ id, name, abbreviation }) => ({ id, name, abbreviation })),
    categories: categories.map(({ id, name, description, imageUrl, displayOrder, isActive }) => ({ id, name, description, imageUrl, displayOrder, isActive })),
    products: products.map((p) => ({
      id: p.id, categoryId: p.categoryId, name: p.name, description: p.description, sku: p.sku, imageUrl: p.imageUrl,
      price: decimal(p.price), cost: decimal(p.cost), isActive: p.isActive, displayOrder: p.displayOrder,
    })),
    ingredients: ingredients.map((i) => ({
      id: i.id, name: i.name, sku: i.sku, unitId: i.unitId, isActive: i.isActive,
      currentStock: decimal(i.currentStock), minimumStock: decimal(i.minimumStock), averageCost: decimal(i.averageCost),
    })),
    recipes: recipes
      .filter((r) => ingredientIds.has(r.ingredientId))
      .map((r) => ({ productId: r.productId, ingredientId: r.ingredientId, quantity: decimal(r.quantity) })),
    extras: extras.map((e) => ({ id: e.id, name: e.name, description: e.description, price: decimal(e.price), cost: decimal(e.cost), isActive: e.isActive })),
    extraRecipes: extraRecipes
      .filter((r) => ingredientIds.has(r.ingredientId))
      .map((r) => ({ extraId: r.extraId, ingredientId: r.ingredientId, quantity: decimal(r.quantity) })),
    productExtras: productExtras.map(({ productId, extraId, isDefault }) => ({ productId, extraId, isDefault })),
    combos: combos.map((c) => ({
      id: c.id, categoryId: c.categoryId, name: c.name, description: c.description, price: decimal(c.price), cost: decimal(c.cost),
      imageUrl: c.imageUrl, isActive: c.isActive, activeOnDays: c.activeOnDays, displayOrder: c.displayOrder,
    })),
    comboItems: comboItems.map((i) => ({ comboId: i.comboId, productId: i.productId, quantity: decimal(i.quantity) })),
    promotions: promotions.map((p) => ({
      id: p.id, name: p.name, description: p.description, type: p.type, discountValue: decimal(p.discountValue),
      buyQuantity: p.buyQuantity, getQuantity: p.getQuantity, startDate: p.startDate.toISOString(), endDate: p.endDate.toISOString(),
      activeOnDays: p.activeOnDays, isActive: p.isActive,
      productIds: p.products.map((link) => link.productId), categoryIds: p.categories.map((link) => link.categoryId),
    })),
    suppliers: suppliers.map(({ id, name, phone, email, address, isActive }) => ({ id, name, phone, email, address, isActive })),
    preferences: preferences.map(({ key, value, type, label, description }) => ({ key, value, type, label, description })),
  };

  const dir = resolve(process.cwd(), 'prisma/seed-data');
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, 'catalog.json');
  writeFileSync(file, `${JSON.stringify(catalog, null, 2)}\n`);

  process.stdout.write(`\nEscrito ${file}\n`);
  console.table({
    unidades: catalog.units.length,
    categorías: catalog.categories.length,
    productos: catalog.products.length,
    ingredientes: catalog.ingredients.length,
    recetas: catalog.recipes.length,
    extras: catalog.extras.length,
    combos: catalog.combos.length,
    promociones: catalog.promotions.length,
    proveedores: catalog.suppliers.length,
    preferencias: catalog.preferences.length,
  });
  if (skipped > 0) process.stdout.write(`Aviso: ${skipped} receta(s) apuntaban a ingredientes eliminados y se omitieron.\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
