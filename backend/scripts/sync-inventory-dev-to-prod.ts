/**
 * Sends DEV's ingredient list to production with its minimum stock, and leaves every
 * production stock at 0 (business decision 2026-11-17: production stock comes from a physical
 * count; costs are not copied).
 *
 *   cd backend && npx tsx scripts/sync-inventory-dev-to-prod.ts                       # preview
 *   cd backend && npx tsx scripts/sync-inventory-dev-to-prod.ts --apply --confirm-host=<host>
 *   ... --allow-unit-change=INS-012,INS-034    unit change on ingredients that have history
 *   ... --target-env <file>                    rehearse on another database (e.g. a local copy)
 *
 * Run it BEFORE scripts/sync-sales-menu-dev-to-prod.ts: production ingredients take DEV's SKU
 * (matched by name), so the recipe sync finds them instead of creating duplicates.
 * Requires the same migrations on both databases and base units (gr, ml, pz) in production
 * (scripts/normalize-catalog.ts). One serializable transaction; sales, cash and expense counts
 * are compared before and after. Idempotent: a second run changes nothing.
 */
import { Prisma, type PrismaClient } from '@prisma/client';
import { appliedMigrations, assertRunFromBackend, createDatabase } from './lib/dev-prod-databases';
import { planInventorySync, type SourceIngredient, type TargetIngredient } from './lib/inventory-sync-plan';
import { assertProductionWriteConfirmed } from '../prisma/seed-guards';

assertRunFromBackend();

const apply = process.argv.includes('--apply');
const allowUnitChange = new Set(
  (process.argv.find((arg) => arg.startsWith('--allow-unit-change='))?.slice('--allow-unit-change='.length) ?? '')
    .split(',').map((sku) => sku.trim()).filter(Boolean),
);
const ZERO_NOTE = 'Existencias en 0 al migrar el inventario de development (conteo físico pendiente)';

async function readSource(db: PrismaClient): Promise<SourceIngredient[]> {
  const rows = await db.ingredient.findMany({
    where: { deletedAt: null },
    select: { sku: true, name: true, minimumStock: true, maximumStock: true, isActive: true, unit: { select: { abbreviation: true } } },
    orderBy: { name: 'asc' },
  });
  return rows.map((row) => {
    if (!row.sku) throw new Error(`"${row.name}" no tiene SKU en development: ejecuta scripts/normalize-catalog.ts.`);
    return {
      sku: row.sku, name: row.name, unit: row.unit.abbreviation,
      minimumStock: row.minimumStock.toNumber(), maximumStock: row.maximumStock?.toNumber() ?? null, isActive: row.isActive,
    };
  });
}

async function readTarget(db: PrismaClient | Prisma.TransactionClient): Promise<TargetIngredient[]> {
  // Soft-deleted ones too: they still hold their name in the unique index and are restored when
  // development has them.
  const rows = await db.ingredient.findMany({
    select: {
      id: true, sku: true, name: true, currentStock: true, deletedAt: true, minimumStock: true, maximumStock: true, isActive: true,
      unit: { select: { abbreviation: true } },
      _count: { select: { movements: true, purchaseItems: true, countItems: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id, sku: row.sku, name: row.name, unit: row.unit.abbreviation,
    currentStock: row.currentStock.toNumber(), minimumStock: row.minimumStock.toNumber(),
    maximumStock: row.maximumStock?.toNumber() ?? null, isActive: row.isActive,
    historyCount: row._count.movements + row._count.purchaseItems + row._count.countItems,
    deleted: row.deletedAt !== null,
  }));
}

/** Business history that this script must never change. */
async function historyCounts(db: Prisma.TransactionClient) {
  const [orders, orderItems, payments, cashMovements, expenses, purchases] = await Promise.all([
    db.order.count(), db.orderItem.count(), db.payment.count(), db.cashMovement.count(), db.expense.count(), db.purchase.count(),
  ]);
  return { orders, orderItems, payments, cashMovements, expenses, purchases };
}

async function main() {
  const development = createDatabase('development');
  const production = createDatabase('production');
  try {
    if (development.identity === production.identity) throw new Error('Development y producción apuntan a la misma base; cancelado.');
    console.log(`Origen development: ${development.identity}`);
    console.log(`Destino production:  ${production.identity} · ${apply ? 'APLICAR' : 'vista previa'}`);

    const [devMigrations, prodMigrations] = await Promise.all([appliedMigrations(development.prisma), appliedMigrations(production.prisma)]);
    const missing = devMigrations.map((m) => m.migration_name).filter((name) => !prodMigrations.some((m) => m.migration_name === name));
    if (missing.length) throw new Error(`Faltan migraciones en el destino: ${missing.join(', ')}. No se hizo ningún cambio.`);

    const units = new Map((await production.prisma.inventoryUnit.findMany({ select: { id: true, abbreviation: true } })).map((u) => [u.abbreviation, u.id]));
    for (const base of ['gr', 'ml', 'pz']) {
      if (!units.has(base)) throw new Error(`El destino no tiene la unidad "${base}": ejecuta scripts/normalize-catalog.ts antes.`);
    }

    const source = await readSource(development.prisma);
    const plan = planInventorySync(source, await readTarget(production.prisma), { allowUnitChange });

    console.log(`\nInsumos en development: ${source.length}`);
    console.log(`  Actualizar en producción: ${plan.updates.length} (SKU, nombre, unidad, mínimo, máximo o estado)`);
    for (const update of plan.updates.filter((u) => u.changes.unit)) {
      console.log(`    unidad ${update.sourceSku}: → ${update.changes.unit}${update.unitChangeWithHistory ? ' (con historial, autorizado)' : ''}`);
    }
    console.log(`  Crear en producción (stock 0): ${plan.creates.length}${plan.creates.length ? ` → ${plan.creates.map((c) => c.name).join(', ')}` : ''}`);
    console.log(`  Poner existencias en 0: ${plan.zeroes.length}${plan.zeroes.length ? ` → ${plan.zeroes.map((z) => `${z.name} ${z.currentStock} ${z.unit}`).join(', ')}` : ''}`);
    console.log(`  Solo en producción (se conservan): ${plan.untouched.length}${plan.untouched.length ? ` → ${plan.untouched.map((u) => u.name).join(', ')}` : ''}`);
    for (const problem of plan.problems) console.log(`  ✖ ${problem}`);

    if (!apply) {
      console.log('\nVista previa: no se escribió nada.');
      return;
    }
    if (plan.problems.length) throw new Error('Hay problemas: no se aplicó nada.');
    if (production.hostname !== 'localhost' && production.hostname !== '127.0.0.1') {
      assertProductionWriteConfirmed({ envMode: 'production', usesProductionDatabase: true, argv: process.argv, databaseHost: production.hostname });
    }

    const admin = await production.prisma.user.findFirst({ where: { isActive: true, role: { name: 'ADMIN' } }, select: { id: true } });
    if (!admin) throw new Error('No hay un ADMIN activo en producción para registrar los ajustes.');

    await production.prisma.$transaction(async (tx) => {
      const before = await historyCounts(tx);
      // Re-planned inside the transaction: what is applied is what the database holds now.
      const current = planInventorySync(source, await readTarget(tx), { allowUnitChange });
      if (current.problems.length) throw new Error(`Cambió el destino desde la vista previa: ${current.problems.join(' ')}`);

      // SKUs first move to a temporary value, so swapping SKUs between rows never collides.
      for (const update of current.updates.filter((u) => u.changes.sku)) {
        await tx.ingredient.update({ where: { id: update.id }, data: { sku: `TMP-${update.id}` } });
      }
      for (const { id, changes } of current.updates) {
        const { unit, restore, ...fields } = changes;
        await tx.ingredient.update({
          where: { id },
          data: { ...fields, ...(unit && { unitId: units.get(unit)! }), ...(restore && { deletedAt: null }) },
        });
      }
      for (const item of current.creates) {
        const unitId = units.get(item.unit);
        if (!unitId) throw new Error(`El destino no tiene la unidad "${item.unit}" de ${item.sku}.`);
        await tx.ingredient.create({
          data: { sku: item.sku, name: item.name, unitId, minimumStock: item.minimumStock, maximumStock: item.maximumStock, isActive: item.isActive },
        });
      }
      for (const zero of current.zeroes) {
        const quantity = new Prisma.Decimal(zero.currentStock).negated();
        await tx.ingredient.update({ where: { id: zero.id }, data: { currentStock: { increment: quantity } } });
        await tx.inventoryMovement.create({
          data: {
            ingredientId: zero.id, type: 'adjustment', quantity, unitCost: 0, referenceType: 'initial_balance',
            balanceAfter: 0, notes: ZERO_NOTE, createdById: admin.id,
          },
        });
      }

      const after = await historyCounts(tx);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        throw new Error('Cambiaron los conteos de ventas, caja, gastos o compras; se revierte todo.');
      }
      const left = await tx.ingredient.count({ where: { deletedAt: null, currentStock: { not: 0 } } });
      // (soft-deleted ingredients keep whatever they had; they are not part of the inventory)
      if (left > 0) throw new Error(`Quedaron ${left} insumo(s) con stock distinto de 0; se revierte todo.`);
      console.log(`\nHistorial protegido (conteos iguales): ${JSON.stringify(after)}`);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15_000, timeout: 120_000 });

    const recheck = planInventorySync(source, await readTarget(production.prisma), { allowUnitChange });
    console.log(`Listo. Pendiente tras aplicar: ${recheck.updates.length + recheck.creates.length + recheck.zeroes.length} cambio(s) (debe ser 0).`);
  } finally {
    await Promise.all([development.prisma.$disconnect(), production.prisma.$disconnect(), development.pool.end(), production.pool.end()]);
  }
}

main().catch((error: unknown) => {
  // Prisma errors may carry an empty message and the detail in code/meta.
  const detail = error instanceof Error
    ? [error.message, (error as { code?: string }).code, JSON.stringify((error as { meta?: unknown }).meta ?? null)]
      .filter((part) => part && part !== 'null').join(' · ')
    : String(error);
  process.stderr.write(`Error: ${detail || (error instanceof Error ? error.name : 'desconocido')}\n`);
  if (error instanceof Error && error.stack && !error.message) process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
