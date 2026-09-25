/**
 * Read-only pre/post check for the migrations
 *   20260923100000_enums_and_expense_fk
 *   20260923110000_uniform_cash_movement_sign
 *   20260923120000_align_ingredients_schema
 *
 * Usage (from backend/, against the database in .env.development; prefix with
 * `npx cross-env NODE_ENV=production` for .env.production):
 *   npx tsx scripts/check-enum-migration.ts            # report only (SELECTs)
 *   npx tsx scripts/check-enum-migration.ts --backup   # also writes prisma/backups/2026-09-23-enums-signs.json
 *
 * Exit code 1 when something would make the migration fail or be unsafe to run now.
 * It never writes to the database. Every column is read as ::text so the same queries work
 * before and after the enums exist.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../src/config/prisma';

const PAYMENT_STATUS = ['paid', 'pending', 'cancelled'];
const MOVEMENT_TYPES = [
  'OPENING', 'CLOSING', 'sale', 'sale_reversal', 'expense', 'expense_adjustment',
  'expense_reversal', 'delivery_collected', 'delivery_handoff', 'delivery_collected_reversal',
];
const DELIVERY_RESPONSIBLE = ['customer_to_courier', 'customer_to_business', 'business_absorbs'];
const EXPENSE_CATEGORIES = ['insumos', 'servicios', 'mantenimiento', 'nomina', 'renta', 'mandadito', 'otros'];
// Types stored with the opposite sign of their drawer effect before 20260923110000.
const OLD_INVERTED = ['expense', 'expense_reversal', 'delivery_handoff'];
const TABLES = ['payments', 'cash_movements', 'expenses', 'orders', 'ingredients'];

type Row = Record<string, unknown>;
const problems: string[] = [];

async function rows<T extends Row = Row>(sql: string): Promise<T[]> {
  const result = await prisma.$queryRawUnsafe<T[]>(sql);
  return JSON.parse(JSON.stringify(result, (_key, value) => (typeof value === 'bigint' ? Number(value) : value)));
}

function section(title: string, data: unknown) {
  process.stdout.write(`\n## ${title}\n`);
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    console.table(data);
  } else {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  }
}

async function distinctOutside(table: string, column: string, allowed: string[], nullable = false) {
  const values = await rows<{ value: string | null; n: number }>(
    `SELECT "${column}"::text AS value, count(*)::int AS n FROM "${table}" GROUP BY 1 ORDER BY 1`,
  );
  section(`${table}.${column}`, values);
  const invalid = values.filter(({ value }) => (value === null ? !nullable : !allowed.includes(value)));
  if (invalid.length > 0) {
    problems.push(`${table}.${column} tiene valores fuera del enum: ${invalid.map((v) => `${v.value} (${v.n})`).join(', ')}`);
  }
}

async function main() {
  const host = (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '').replace(/\/\/[^@]*@/, '//***@');
  process.stdout.write(`Base de datos: ${host}\n`);

  const applied = await rows<{ migration_name: string; finished: boolean }>(
    `SELECT migration_name::text AS migration_name, finished_at IS NOT NULL AS finished FROM _prisma_migrations WHERE migration_name LIKE '20260923%' ORDER BY 1`,
  );
  section('Migraciones 20260923* registradas', applied);
  const failed = applied.filter((m) => !m.finished);
  if (failed.length > 0) {
    problems.push(`Migración marcada como fallida: ${failed.map((m) => m.migration_name).join(', ')} — corrige el dato y ejecuta "npx prisma migrate resolve --rolled-back <nombre>" antes de reintentar`);
  }
  const signMigrated = applied.some((m) => m.migration_name === '20260923110000_uniform_cash_movement_sign' && m.finished);

  await distinctOutside('payments', 'status', PAYMENT_STATUS);
  await distinctOutside('cash_movements', 'type', MOVEMENT_TYPES);
  await distinctOutside('expenses', 'category', EXPENSE_CATEGORIES);
  await distinctOutside('orders', 'deliveryResponsible', DELIVERY_RESPONSIBLE, true);

  const orphans = await rows(
    `SELECT count(*)::int AS total, count(e."sourceOrderId")::int AS con_orden,
            count(*) FILTER (WHERE e."sourceOrderId" IS NOT NULL AND o.id IS NULL)::int AS huerfanos
     FROM expenses e LEFT JOIN orders o ON o.id = e."sourceOrderId"`,
  );
  section('expenses.sourceOrderId (los huérfanos se ponen en NULL al crear la FK)', orphans);

  section(
    `Signos por tipo de movimiento (convención ${signMigrated ? 'NUEVA: amount = efecto en caja' : 'VIEJA'})`,
    await rows(
      `SELECT type::text AS type, count(*)::int AS n,
              count(*) FILTER (WHERE amount > 0)::int AS positivos,
              count(*) FILTER (WHERE amount < 0)::int AS negativos
       FROM cash_movements GROUP BY 1 ORDER BY 1`,
    ),
  );

  // Every session's movements (except CLOSING) must add up to its expectedAmount.
  const effect = signMigrated
    ? `amount`
    : `CASE WHEN type::text IN (${OLD_INVERTED.map((t) => `'${t}'`).join(',')}) THEN -amount ELSE amount END`;
  const mismatched = await rows(
    `SELECT s.id, s.status, s."expectedAmount"::text AS esperado, COALESCE(sum(${effect}) FILTER (WHERE m.type::text <> 'CLOSING'), 0)::text AS suma
     FROM cash_sessions s LEFT JOIN cash_movements m ON m."cashSessionId" = s.id
     GROUP BY s.id HAVING s."expectedAmount" <> COALESCE(sum(${effect}) FILTER (WHERE m.type::text <> 'CLOSING'), 0)
     ORDER BY s."openedAt" DESC LIMIT 20`,
  );
  section('Sesiones cuya suma de movimientos no coincide con expectedAmount (debe estar vacío)', mismatched);
  if (mismatched.length > 0) problems.push(`${mismatched.length} sesión(es) no cuadran con sus movimientos (revisar antes de migrar)`);

  const open = await rows(`SELECT id, "openedAt" FROM cash_sessions WHERE status = 'open'`);
  section('Sesiones de caja abiertas (migrar sin caja abierta y con el backend detenido)', open);
  if (open.length > 0 && !signMigrated) problems.push('Hay una caja abierta: ciérrala y detén el backend antes de migrar');

  const tableList = TABLES.map((t) => `'${t}'`).join(',');
  const dependents = await rows(
    `SELECT 'view' AS kind, v.view_name::text AS name FROM information_schema.view_table_usage v WHERE v.table_name::text IN (${tableList})
     UNION ALL SELECT 'policy', tablename::text || '.' || policyname::text FROM pg_policies WHERE tablename::text IN (${tableList})
     UNION ALL SELECT 'trigger', tgrelid::regclass::text || '.' || tgname::text FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text IN (${tableList})`,
  );
  section('Vistas / políticas RLS / triggers sobre estas tablas (bloquean ALTER TYPE si usan las columnas)', dependents);
  if (dependents.length > 0 && !signMigrated) problems.push('Hay vistas, políticas o triggers sobre las tablas afectadas: revisar si usan las columnas antes de migrar');

  section(
    'Constraints e índices relevantes',
    await rows(
      `SELECT conrelid::regclass::text AS tabla, conname::text AS nombre, pg_get_constraintdef(oid) AS definicion FROM pg_constraint
       WHERE conname IN ('payments_status_check','cash_movements_type_check','expenses_sourceOrderId_fkey')
       UNION ALL SELECT tablename::text, indexname::text, indexdef FROM pg_indexes
       WHERE indexname IN ('payments_paid_date_idx','ingredients_sku_unique','ingredients_active_idx')
       ORDER BY 1, 2`,
    ),
  );
  section(
    'ingredients.deletedAt',
    await rows(`SELECT data_type::text AS data_type FROM information_schema.columns WHERE table_name = 'ingredients' AND column_name = 'deletedAt'`),
  );

  if (process.argv.includes('--backup')) {
    const backup: Record<string, unknown> = { takenAt: new Date().toISOString(), migrations: ['20260923100000', '20260923110000', '20260923120000'] };
    for (const table of TABLES) {
      backup[table] = (await rows<{ row: Row }>(`SELECT row_to_json(t) AS row FROM "${table}" t`)).map(({ row }) => row);
    }
    const dir = resolve(process.cwd(), 'prisma/backups');
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, '2026-09-23-enums-signs.json');
    writeFileSync(file, JSON.stringify(backup, null, 2));
    process.stdout.write(`\nRespaldo escrito en ${file}\n`);
  }

  process.stdout.write(problems.length === 0 ? '\nOK: nada bloquea la migración.\n' : `\nBLOQUEANTES:\n- ${problems.join('\n- ')}\n`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
