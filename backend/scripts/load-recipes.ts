/**
 * Loads prisma/recipe-catalog.ts into the database of .env.<NODE_ENV> (development by default).
 *
 *   cd backend && npx tsx scripts/load-recipes.ts                      # preview (writes nothing)
 *   cd backend && npx tsx scripts/load-recipes.ts --report=<file.md>   # preview + Markdown report
 *   cd backend && npx tsx scripts/load-recipes.ts --apply              # write
 *
 * Refuses the production database (load in development, then sync with
 * scripts/sync-sales-menu-dev-to-prod.ts). Each recipe goes through ProductService.update, so
 * the same rules as the product screen apply (Jumbo recipe required, temperatures only for
 * products sold both ways, active ingredients) and the change is audited.
 */
import { writeFileSync } from 'node:fs';
import { Prisma } from '@prisma/client';
import { ENV_MODE, USES_PRODUCTION_DATABASE, databaseIdentity } from '../src/config/env';
import { prisma } from '../src/config/prisma';
import { ProductService } from '../src/services/product.service';
import type { AuthUser } from '../src/services/auth.service';
import {
  NEW_INGREDIENTS,
  RECIPE_CATALOG,
  jumboOf,
  normalizeIngredientName,
  type RecipeCatalogLine,
} from '../prisma/recipe-catalog';

/** Ingredients whose unit must change for the recipe to make sense (only if never used). */
const UNIT_CHANGES: { name: string; to: 'gr' | 'ml' | 'pz'; why: string }[] = [
  { name: 'Aguacate', to: 'gr', why: 'la receta usa 50 gr (la hoja: "cambiar a kg")' },
];

const apply = process.argv.includes('--apply');
const reportPath = process.argv.find((arg) => arg.startsWith('--report='))?.slice('--report='.length);

type Unit = { id: string; abbreviation: string };

async function main() {
  if (ENV_MODE === 'production' || USES_PRODUCTION_DATABASE) {
    throw new Error('Este script no escribe en producción: carga en desarrollo y sincroniza con sync-sales-menu-dev-to-prod.');
  }
  const target = databaseIdentity(process.env.DIRECT_URL ?? process.env.DATABASE_URL) ?? '(sin DATABASE_URL)';
  console.log(`Modo: ${ENV_MODE} · BD: ${target.replace(/^([^@]{0,14})[^@]*@/, '$1…@')} · ${apply ? 'APLICAR' : 'vista previa'}`);

  const [units, ingredients, products] = await Promise.all([
    prisma.inventoryUnit.findMany({ select: { id: true, abbreviation: true } }),
    prisma.ingredient.findMany({
      where: { deletedAt: null },
      select: { id: true, sku: true, name: true, isActive: true, currentStock: true, unit: { select: { id: true, abbreviation: true } } },
    }),
    prisma.product.findMany({
      select: {
        id: true, sku: true, name: true, isActive: true, temperature: true, jumboPrice: true, tracksInventory: true,
        category: { select: { isBeverage: true } }, _count: { select: { recipes: true } },
      },
    }),
  ]);
  const unitByAbbr = new Map(units.map((unit) => [unit.abbreviation, unit as Unit]));
  const byName = new Map(ingredients.map((ingredient) => [normalizeIngredientName(ingredient.name), ingredient]));
  const bySku = new Map(products.map((product) => [product.sku, product]));
  const problems: string[] = [];
  const report: string[] = [`# Carga de recetas — ${apply ? 'aplicada' : 'vista previa'} (${new Date().toISOString().slice(0, 10)})`, ''];

  // 1. New ingredients (Jumbo cups).
  const missingNew = NEW_INGREDIENTS.filter(({ name }) => !byName.has(normalizeIngredientName(name)));
  report.push('## Insumos nuevos', '', missingNew.length === 0 ? 'Ninguno (ya existen).' : missingNew.map((i) => `- ${i.name} (${i.unit})`).join('\n'), '');

  // 2. Unit changes.
  report.push('## Cambios de unidad', '');
  for (const change of UNIT_CHANGES) {
    const ingredient = byName.get(normalizeIngredientName(change.name));
    if (!ingredient) { problems.push(`No existe el insumo "${change.name}".`); continue; }
    if (ingredient.unit.abbreviation === change.to) { report.push(`- ${change.name}: ya está en ${change.to}.`); continue; }
    const used = await prisma.inventoryMovement.count({ where: { ingredientId: ingredient.id } })
      + await prisma.purchaseItem.count({ where: { ingredientId: ingredient.id } });
    if (used > 0 || !ingredient.currentStock.isZero()) {
      problems.push(`"${change.name}" está en ${ingredient.unit.abbreviation} y ya tiene stock o movimientos: cambiar su unidad requiere una decisión aparte.`);
      continue;
    }
    report.push(`- ${change.name}: ${ingredient.unit.abbreviation} → ${change.to} (${change.why}).`);
  }
  report.push('');

  // 3. Recipes.
  report.push('## Recetas', '');
  const pending: { productId: string; sku: string; name: string; setTemperature?: 'HOT' | 'COLD' | 'BOTH'; regular: RecipeCatalogLine[]; jumbo: RecipeCatalogLine[] }[] = [];
  for (const entry of RECIPE_CATALOG) {
    const product = bySku.get(entry.sku);
    if (!product) { problems.push(`No existe el producto ${entry.sku} (${entry.sheetName}).`); continue; }
    const temperature = entry.setTemperature ?? product.temperature;
    const jumboAvailable = product.jumboPrice !== null && (product.category?.isBeverage ?? false);
    if (entry.jumbo && !jumboAvailable) problems.push(`${entry.sku} no tiene precio Jumbo pero la hoja pide receta Jumbo.`);
    if (!entry.jumbo && jumboAvailable) problems.push(`${entry.sku} se vende en Jumbo: falta su receta Jumbo.`);
    const usesTemperature = entry.regular.some((line) => line.temperature && line.temperature !== 'BOTH');
    if (usesTemperature && temperature !== 'BOTH') problems.push(`${entry.sku} tiene líneas fría/caliente pero no se vende de ambas formas.`);

    const jumbo = entry.jumbo ? jumboOf(entry.regular) : [];
    for (const line of [...entry.regular, ...jumbo]) {
      const known = byName.get(normalizeIngredientName(line.ingredient))
        ?? NEW_INGREDIENTS.find((i) => normalizeIngredientName(i.name) === normalizeIngredientName(line.ingredient));
      if (!known) problems.push(`${entry.sku}: no existe el insumo "${line.ingredient}".`);
      else if ('isActive' in known && !known.isActive) problems.push(`${entry.sku}: el insumo "${line.ingredient}" está inactivo.`);
    }

    const fmt = (lines: RecipeCatalogLine[]) => lines.map((line) => {
      const ingredient = byName.get(normalizeIngredientName(line.ingredient));
      const unit = UNIT_CHANGES.find((c) => normalizeIngredientName(c.name) === normalizeIngredientName(line.ingredient))?.to
        ?? ingredient?.unit.abbreviation ?? NEW_INGREDIENTS.find((i) => i.name === line.ingredient)?.unit ?? '?';
      const temp = line.temperature && line.temperature !== 'BOTH' ? (line.temperature === 'HOT' ? ' · caliente' : ' · frío') : '';
      return `| ${line.ingredient} | ${line.quantity} ${unit}${temp} |`;
    }).join('\n');
    report.push(
      `### ${entry.sku} ${product.name}${entry.setTemperature && entry.setTemperature !== product.temperature ? ` (temperatura: ${product.temperature ?? '—'} → ${entry.setTemperature})` : ''}`,
      `Hoja: ${entry.sheetName}${product._count.recipes > 0 ? ` · reemplaza ${product._count.recipes} líneas actuales` : ''}`,
      '', '| Insumo | Regular |', '|---|---|', fmt(entry.regular), '',
      ...(jumbo.length > 0 ? ['| Insumo | Jumbo |', '|---|---|', fmt(jumbo), ''] : []),
    );
    pending.push({ productId: product.id, sku: entry.sku, name: product.name, setTemperature: entry.setTemperature, regular: entry.regular, jumbo });
  }

  const loaded = new Set(RECIPE_CATALOG.map((entry) => entry.sku));
  const withoutRecipe = products.filter((p) => p.isActive && p.tracksInventory && !loaded.has(p.sku) && p._count.recipes === 0);
  report.push('## Productos activos que quedan sin receta', '',
    withoutRecipe.length === 0 ? 'Ninguno.' : withoutRecipe.map((p) => `- ${p.sku} ${p.name}`).join('\n'),
    '', 'Mientras haya productos así no se puede activar "Descontar inventario al vender": captura su receta o márcalos como "No controla inventario".', '');
  report.push('## Problemas', '', problems.length === 0 ? 'Ninguno.' : problems.map((p) => `- ${p}`).join('\n'), '');

  if (reportPath) writeFileSync(reportPath, report.join('\n'));
  console.log(`${pending.length} recetas listas · ${missingNew.length} insumos nuevos · ${withoutRecipe.length} productos sin receta · ${problems.length} problemas`);
  for (const problem of problems) console.log(`  ✖ ${problem}`);
  if (!apply) return;
  if (problems.length > 0) throw new Error('Hay problemas: no se aplicó nada.');

  // --- Writes ---
  const admin = await prisma.user.findFirst({
    where: { isActive: true, role: { name: 'ADMIN' } },
    select: { id: true, name: true, email: true, roleId: true, isActive: true, role: { select: { name: true, permissions: { select: { permission: { select: { name: true } } } } } } },
  });
  if (!admin) throw new Error('No hay un ADMIN activo para registrar el cambio.');
  const actor: AuthUser = {
    id: admin.id, name: admin.name, email: admin.email, roleId: admin.roleId, roleName: admin.role.name, isActive: admin.isActive,
    permissions: admin.role.permissions.map(({ permission }) => permission.name),
  };

  const lastSku = await prisma.ingredient.findMany({ where: { sku: { startsWith: 'INS-' } }, select: { sku: true } });
  let next = Math.max(0, ...lastSku.map(({ sku }) => Number(sku?.slice(4)) || 0)) + 1;
  for (const ingredient of missingNew) {
    const unit = unitByAbbr.get(ingredient.unit);
    if (!unit) throw new Error(`No existe la unidad ${ingredient.unit}.`);
    const created = await prisma.ingredient.create({
      data: { name: ingredient.name, sku: `INS-${String(next++).padStart(3, '0')}`, unitId: unit.id, currentStock: new Prisma.Decimal(0), averageCost: new Prisma.Decimal(0) },
      select: { id: true, sku: true, name: true, isActive: true, currentStock: true, unit: { select: { id: true, abbreviation: true } } },
    });
    byName.set(normalizeIngredientName(created.name), created);
    console.log(`  + insumo ${created.sku} ${created.name}`);
  }
  for (const change of UNIT_CHANGES) {
    const ingredient = byName.get(normalizeIngredientName(change.name))!;
    if (ingredient.unit.abbreviation === change.to) continue;
    const unit = unitByAbbr.get(change.to)!;
    await prisma.ingredient.update({ where: { id: ingredient.id }, data: { unitId: unit.id } });
    byName.set(normalizeIngredientName(change.name), { ...ingredient, unit });
    console.log(`  ~ ${change.name}: unidad → ${change.to}`);
  }

  const toInput = (lines: RecipeCatalogLine[]) => lines.map((line) => ({
    ingredientId: byName.get(normalizeIngredientName(line.ingredient))!.id,
    quantity: line.quantity,
    ...(line.temperature && line.temperature !== 'BOTH' && { temperature: line.temperature }),
  }));
  for (const item of pending) {
    await ProductService.update(item.productId, {
      ...(item.setTemperature && { temperature: item.setTemperature }),
      recipe: { REGULAR: toInput(item.regular), ...(item.jumbo.length > 0 && { JUMBO: toInput(item.jumbo) }) },
    }, actor);
    console.log(`  ✔ ${item.sku} ${item.name}`);
  }
  console.log('Listo.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
