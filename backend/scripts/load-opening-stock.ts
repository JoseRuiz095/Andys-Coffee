/**
 * Loads the opening stock of prisma/opening-stock.ts (business inventory sheet, May 2026)
 * into the database of .env.<NODE_ENV> (development by default).
 *
 *   cd backend && npm run seed:inventory                              # preview (writes nothing)
 *   cd backend && npm run seed:inventory -- --report=<file.md>        # preview + Markdown report
 *   cd backend && npm run seed:inventory -- --apply                   # write
 *   cd backend && npm run seed:inventory:prod -- --apply --confirm-host=<host>   # production
 *
 * Prerequisite: units normalized and the ingredients created
 * (`npx tsx scripts/normalize-catalog.ts --apply --with-ingredients`). An ingredient of the
 * sheet that does not exist yet is created here with the next INS-### SKU.
 *
 * Never overwrites live stock: an ingredient that already has stock, movements or purchases is
 * skipped, and so is one whose minimum stock was already set (by a previous run or by hand). For the rest, in one transaction per ingredient: its unit is aligned with
 * prisma/ingredient-catalog.ts (only if no recipe uses it), the minimum stock is set and the
 * stock is recorded as an 'adjustment' movement (referenceType 'initial_balance'), so the
 * movement history adds up to the stock. A second --apply changes nothing.
 */
import { writeFileSync } from 'node:fs';
import { Prisma } from '@prisma/client';
import { ENV_MODE, USES_PRODUCTION_DATABASE, databaseIdentity } from '../src/config/env';
import { prisma } from '../src/config/prisma';
import { INGREDIENT_CATALOG, type BaseUnit } from '../prisma/ingredient-catalog';
import { OPENING_STOCK, OPENING_STOCK_SOURCE, toBaseQuantity } from '../prisma/opening-stock';
import { normalizeIngredientName as normalize } from '../prisma/recipe-catalog';
import { assertProductionWriteConfirmed, databaseHostOf, targetsProduction } from '../prisma/seed-guards';

const apply = process.argv.includes('--apply');
const reportPath = process.argv.find((arg) => arg.startsWith('--report='))?.slice('--report='.length);

interface Plan {
  name: string;
  ingredientId: string | null;
  unit: BaseUnit;
  unitChange: string | null;
  stock: number;
  minimum: number;
  notes: string[];
}

async function main() {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const target = { envMode: ENV_MODE, usesProductionDatabase: USES_PRODUCTION_DATABASE };
  if (apply) assertProductionWriteConfirmed({ ...target, argv: process.argv, databaseHost: databaseHostOf(databaseUrl) });
  const identity = databaseIdentity(databaseUrl) ?? '(sin DATABASE_URL)';
  console.log(
    `Modo: ${ENV_MODE}${targetsProduction(target) ? ' (PRODUCCIÓN)' : ''} · BD: ${identity.replace(/^([^@]{0,14})[^@]*@/, '$1…@')} · ` +
      `${apply ? 'APLICAR' : 'vista previa'}`,
  );

  const [units, ingredients] = await Promise.all([
    prisma.inventoryUnit.findMany({ select: { id: true, abbreviation: true } }),
    prisma.ingredient.findMany({
      where: { deletedAt: null },
      select: {
        id: true, name: true, currentStock: true, minimumStock: true, maximumStock: true,
        unit: { select: { id: true, abbreviation: true } },
        _count: { select: { movements: true, purchaseItems: true, recipes: true, extraRecipes: true, countItems: true } },
      },
    }),
  ]);
  const unitByAbbr = new Map(units.map((unit) => [unit.abbreviation, unit]));
  const byName = new Map(ingredients.map((ingredient) => [normalize(ingredient.name), ingredient]));
  const catalogUnit = new Map(INGREDIENT_CATALOG.map((entry) => [normalize(entry.name), entry.unit]));
  const problems: string[] = [];
  const skipped: string[] = [];
  const plans: Plan[] = [];

  for (const missing of (['gr', 'ml', 'pz'] as const).filter((abbr) => !unitByAbbr.has(abbr))) {
    problems.push(`No existe la unidad "${missing}": corre primero scripts/normalize-catalog.ts --apply.`);
  }

  for (const entry of OPENING_STOCK) {
    const key = normalize(entry.name);
    const unit = catalogUnit.get(key);
    if (!unit) { problems.push(`"${entry.name}" no está en prisma/ingredient-catalog.ts.`); continue; }
    if (entry.stock === null && entry.minimum === null) { skipped.push(`${entry.name}: la hoja no tiene datos.`); continue; }

    const ingredient = byName.get(key);
    if (ingredient) {
      const used = ingredient._count.movements + ingredient._count.purchaseItems + ingredient._count.countItems;
      if (used > 0 || !ingredient.currentStock.isZero()) {
        skipped.push(`${ingredient.name}: ya tiene stock (${ingredient.currentStock.toString()} ${ingredient.unit.abbreviation}) o movimientos; no se toca.`);
        continue;
      }
      if (!ingredient.minimumStock.isZero()) {
        skipped.push(`${ingredient.name}: ya tiene stock mínimo (${ingredient.minimumStock.toString()} ${ingredient.unit.abbreviation}); no se toca.`);
        continue;
      }
    }

    const notes: string[] = [];
    const convert = (value: number | null, label: string) => {
      if (value === null) return 0;
      const result = toBaseQuantity(entry, value, unit);
      if (!result.ok) { problems.push(`${entry.name} (${label}): ${result.reason}.`); return null; }
      if (result.note && !notes.includes(result.note)) notes.push(result.note);
      return result.value;
    };
    const stock = convert(entry.stock, 'stock');
    if (stock === null) continue;
    const minimum = convert(entry.minimum, 'mínimo');
    if (minimum === null) continue;
    if (stock < 0 || minimum < 0) { problems.push(`${entry.name}: valores negativos.`); continue; }

    let unitChange: string | null = null;
    if (ingredient && ingredient.unit.abbreviation !== unit) {
      if (ingredient._count.recipes + ingredient._count.extraRecipes > 0) {
        problems.push(`${ingredient.name} está en ${ingredient.unit.abbreviation} y una receta lo usa; el catálogo dice ${unit}. Decide su unidad aparte.`);
        continue;
      }
      unitChange = `${ingredient.unit.abbreviation} → ${unit}`;
    }
    if (ingredient?.maximumStock && ingredient.maximumStock.lessThan(minimum)) {
      problems.push(`${ingredient.name}: el mínimo de la hoja (${minimum}) supera su máximo (${ingredient.maximumStock.toString()}).`);
      continue;
    }
    if (ingredient && !unitChange && stock === 0 && minimum === 0) { skipped.push(`${ingredient.name}: stock y mínimo en 0, nada que cargar.`); continue; }
    plans.push({ name: ingredient?.name ?? entry.name, ingredientId: ingredient?.id ?? null, unit, unitChange, stock, minimum, notes });
  }

  const report = [
    `# Saldo inicial de inventario — ${apply ? 'aplicado' : 'vista previa'} (${new Date().toISOString().slice(0, 10)})`,
    '', `Fuente: ${OPENING_STOCK_SOURCE}. BD: ${ENV_MODE}.`, '',
    '| Insumo | Stock | Mínimo | Notas |', '|---|---|---|---|',
    ...plans.map((plan) => `| ${plan.name}${plan.ingredientId ? '' : ' (nuevo)'} | ${plan.stock} ${plan.unit} | ${plan.minimum} ${plan.unit} | ${
      [plan.unitChange && `unidad ${plan.unitChange}`, ...plan.notes].filter(Boolean).join('; ')} |`),
    '', '## Omitidos', '', skipped.length === 0 ? 'Ninguno.' : skipped.map((line) => `- ${line}`).join('\n'),
    '', '## Problemas (no se cargan)', '', problems.length === 0 ? 'Ninguno.' : problems.map((line) => `- ${line}`).join('\n'), '',
  ];
  if (reportPath) writeFileSync(reportPath, report.join('\n'));

  const created = plans.filter((plan) => !plan.ingredientId).length;
  console.log(`${plans.length} insumos con saldo inicial (${created} nuevos) · ${skipped.length} omitidos · ${problems.length} problemas`);
  for (const problem of problems) console.log(`  ✖ ${problem}`);
  if (!apply) return;
  if (problems.some((problem) => problem.startsWith('No existe la unidad'))) throw new Error('Faltan unidades base: no se aplicó nada.');

  // --- Writes ---
  const admin = await prisma.user.findFirst({ where: { isActive: true, role: { name: 'ADMIN' } }, select: { id: true } });
  if (!admin) throw new Error('No hay un ADMIN activo para registrar los movimientos.');
  const skus = await prisma.ingredient.findMany({ where: { sku: { startsWith: 'INS-' } }, select: { sku: true } });
  let nextSku = Math.max(0, ...skus.map(({ sku }) => Number(sku?.slice(4)) || 0)) + 1;
  let applied = 0;

  for (const plan of plans) {
    const unitId = unitByAbbr.get(plan.unit)!.id;
    const stock = new Prisma.Decimal(plan.stock);
    const done = await prisma.$transaction(async (tx) => {
      let ingredientId = plan.ingredientId;
      if (ingredientId) {
        // Re-checked inside the transaction: a sale or purchase since the preview wins.
        const current = await tx.ingredient.findUnique({
          where: { id: ingredientId },
          select: { currentStock: true, minimumStock: true, _count: { select: { movements: true, purchaseItems: true } } },
        });
        if (!current || !current.currentStock.isZero() || !current.minimumStock.isZero() || current._count.movements + current._count.purchaseItems > 0) return false;
        await tx.ingredient.update({ where: { id: ingredientId }, data: { unitId, minimumStock: plan.minimum, currentStock: stock } });
      } else {
        const sku = `INS-${String(nextSku++).padStart(3, '0')}`;
        ingredientId = (await tx.ingredient.create({
          data: { name: plan.name, sku, unitId, minimumStock: plan.minimum, currentStock: stock },
          select: { id: true },
        })).id;
      }
      if (!stock.isZero()) {
        await tx.inventoryMovement.create({
          data: {
            ingredientId,
            type: 'adjustment',
            quantity: stock,
            unitCost: 0,
            referenceType: 'initial_balance',
            balanceAfter: stock,
            notes: `Saldo inicial: ${OPENING_STOCK_SOURCE}${plan.notes.length > 0 ? ` (${plan.notes.join('; ')})` : ''}`,
            createdById: admin.id,
          },
        });
      }
      return true;
    });
    if (done) {
      applied += 1;
      console.log(`  ✔ ${plan.name}: ${plan.stock} ${plan.unit} (mínimo ${plan.minimum})`);
    } else {
      console.log(`  · ${plan.name}: cambió desde la vista previa; no se toca.`);
    }
  }
  console.log(`Listo: ${applied} insumos.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
