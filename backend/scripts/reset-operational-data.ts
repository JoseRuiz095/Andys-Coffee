/**
 * Deletes the OPERATIONAL data of the database in .env.<NODE_ENV> so the business starts
 * clean, keeping the catalog and the configuration.
 *
 *   cd backend && npm run db:reset-operations:prod -- --yes      # production
 *   cd backend && npm run db:reset-operations -- --yes           # development
 *
 * Deleted: orders (+ items, extras, payments), cash sessions and movements, expenses,
 * purchases, inventory movements and physical counts, notifications, audit log and saved
 * income-statement snapshots. The order number and the "Cliente N" sequence restart at 1.
 * Kept: categories, products, recipes, extras, combos, promotions, ingredients, units,
 * suppliers, cash registers, system preferences, roles, permissions and users.
 * Stock: each ingredient keeps its current stock and average cost, recorded as one
 * 'adjustment' movement with referenceType 'initial_balance' so the history adds up.
 *
 * Everything runs in ONE transaction. TRUNCATE is used WITHOUT CASCADE: if an unlisted
 * table referenced these ones, it fails instead of emptying it. Stop the backend first and
 * take a backup (e.g. `npm run db:replicate-prod-to-dev -- --yes` keeps a copy in backups/).
 */
import { Prisma } from '@prisma/client';
import { ENV_MODE, databaseIdentity } from '../src/config/env';
import { prisma } from '../src/config/prisma';

const OPERATIONAL_TABLES = [
  'order_item_extras',
  'order_items',
  'payments',
  'expenses',
  'orders',
  'cash_movements',
  'audit_logs',
  'cash_sessions',
  'purchase_items',
  'purchases',
  'inventory_count_items',
  'inventory_counts',
  'inventory_movements',
  'notification_recipients',
  'notifications',
  'income_statement_daily_snapshots',
] as const;

async function countRows() {
  const counts: Record<string, number> = {};
  for (const table of [...OPERATIONAL_TABLES, 'products', 'ingredients', 'users']) {
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${table}"`);
    counts[table] = n;
  }
  return counts;
}

async function main() {
  if (!process.argv.includes('--yes')) {
    throw new Error('Esto BORRA ventas, cajas, gastos, compras y movimientos de la BD. Vuelve a ejecutar con --yes.');
  }
  const target = databaseIdentity(process.env.DIRECT_URL ?? process.env.DATABASE_URL) ?? '(sin DATABASE_URL)';
  process.stdout.write(`Modo: ${ENV_MODE}\nBase de datos: ${target.replace(/^([^@]{0,14})[^@]*@/, '$1…@')}\n`);

  const openSessions = await prisma.cashSession.count({ where: { status: 'open' } });
  if (openSessions > 0) {
    throw new Error('Hay una caja abierta: ciérrala (y detén el backend) antes de limpiar.');
  }

  const before = await countRows();
  process.stdout.write('\nAntes:\n');
  console.table(before);

  const initialBalances = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${OPERATIONAL_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY`);
      await tx.$executeRawUnsafe('ALTER SEQUENCE customer_name_sequence RESTART');

      const admin = await tx.user.findFirst({ where: { role: { name: 'ADMIN' }, isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      const stocked = await tx.ingredient.findMany({
        where: { deletedAt: null, NOT: { currentStock: 0 } },
        select: { id: true, currentStock: true, averageCost: true },
      });
      const today = new Date().toISOString().slice(0, 10);
      await tx.inventoryMovement.createMany({
        data: stocked.map((ingredient) => ({
          ingredientId: ingredient.id,
          type: 'adjustment',
          quantity: ingredient.currentStock,
          unitCost: ingredient.averageCost ?? new Prisma.Decimal(0),
          referenceType: 'initial_balance',
          notes: `Saldo inicial al limpiar la operación (${today})`,
          createdById: admin?.id ?? null,
        })),
      });
      return stocked.length;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000, maxWait: 30_000 },
  );

  const after = await countRows();
  process.stdout.write('\nDespués:\n');
  console.table(after);
  process.stdout.write(`\nListo: ${initialBalances} ingredientes con stock quedaron con su movimiento de saldo inicial. Los pedidos y "Cliente N" vuelven a empezar en 1.\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`\nError: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
