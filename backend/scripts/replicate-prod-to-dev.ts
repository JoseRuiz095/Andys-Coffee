/**
 * Replaces ALL data of the development database (.env.development) with a copy of the
 * production data (.env.production). Production is only READ.
 *
 *   cd backend && npm run db:replicate-prod-to-dev -- --yes
 *
 * 1. Refuses if development points to the production database, or if both databases do not
 *    have exactly the same migrations applied (run `npm run prisma:migrate:deploy` first).
 * 2. `pg_dump --data-only` of the production `public` schema (without _prisma_migrations) to
 *    backend/backups/prod-data-<timestamp>.sql (git-ignored: it contains personal data).
 * 3. In development, in ONE transaction: truncate every table of `public` (except
 *    _prisma_migrations) and load the copy. If anything fails, development is left untouched.
 *
 * Uses the postgres:17-alpine Docker image for pg_dump/psql (no local install needed).
 * Reads the two env files directly and ignores NODE_ENV and the terminal's variables.
 * Storage images are copied separately: `npm run storage:copy-to-dev`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { databaseIdentity } from '../src/config/env';

const PG_IMAGE = 'postgres:17-alpine';

function connectionFromEnvFile(file: string): string {
  const fullPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(fullPath)) throw new Error(`No existe ${file} (ejecuta el script desde backend/).`);
  const env = dotenv.parse(fs.readFileSync(fullPath));
  const raw = env.DIRECT_URL || env.DATABASE_URL;
  if (!raw) throw new Error(`${file} no define DIRECT_URL ni DATABASE_URL.`);
  // libpq rejects parameters it does not know (e.g. pgbouncer=true): keep only sslmode.
  const url = new URL(raw);
  const sslmode = url.searchParams.get('sslmode') ?? 'require';
  url.search = '';
  url.searchParams.set('sslmode', sslmode === 'verify-full' || sslmode === 'verify-ca' ? 'require' : sslmode);
  return url.toString();
}

/** Runs a command inside the Postgres image with DB_URL set; returns stdout as text. */
function runInPg(dbUrl: string, script: string, options: { stdinText?: string; stdoutFile?: string } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['run', '--rm', '-i', '-e', 'DB_URL', PG_IMAGE, 'sh', '-c', script], {
      env: { ...process.env, DB_URL: dbUrl },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const out = options.stdoutFile ? fs.createWriteStream(options.stdoutFile) : null;
    child.stdout.on('data', (chunk: Buffer) => (out ? out.write(chunk) : (stdout += chunk.toString())));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      const finish = () => (code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || `El proceso terminó con código ${code}`)));
      // Wait until the dump is fully flushed to disk before reading it.
      if (out) out.end(finish);
      else finish();
    });
    child.stdin.end(options.stdinText ?? '');
  });
}

const psqlQuery = (sql: string) => `psql "$DB_URL" -v ON_ERROR_STOP=1 -At -c "${sql.replace(/"/g, '\\"')}"`;

async function appliedMigrations(dbUrl: string): Promise<string[]> {
  const out = await runInPg(dbUrl, psqlQuery('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY 1'));
  return out.split('\n').map((line) => line.trim()).filter(Boolean);
}

async function main() {
  if (!process.argv.includes('--yes')) {
    throw new Error('Esto BORRA todos los datos de la BD de desarrollo y los reemplaza por los de producción. Vuelve a ejecutar con --yes.');
  }

  // --prod-env/--dev-env only exist to rehearse against other databases (e.g. local Docker ones).
  const argValue = (name: string) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
  };
  const production = connectionFromEnvFile(argValue('--prod-env') ?? '.env.production');
  const development = connectionFromEnvFile(argValue('--dev-env') ?? '.env.development');
  const productionId = databaseIdentity(production);
  const developmentId = databaseIdentity(development);
  if (!productionId || !developmentId) throw new Error('No se pudieron leer las cadenas de conexión.');
  if (productionId === developmentId) {
    throw new Error('.env.development apunta a la BD de producción: configura una BD propia para desarrollo.');
  }
  const host = (id: string) => id.replace(/^[^@]*@/, '');
  process.stdout.write(`Origen (solo lectura): ${host(productionId)}\nDestino (se reemplaza): ${host(developmentId)}\n\n`);

  process.stdout.write('Comparando migraciones...\n');
  const [productionMigrations, developmentMigrations] = await Promise.all([appliedMigrations(production), appliedMigrations(development)]);
  const missingInDev = productionMigrations.filter((m) => !developmentMigrations.includes(m));
  const extraInDev = developmentMigrations.filter((m) => !productionMigrations.includes(m));
  if (missingInDev.length > 0 || extraInDev.length > 0) {
    throw new Error(
      'Las BD no tienen las mismas migraciones.\n' +
        (missingInDev.length ? `  Faltan en desarrollo: ${missingInDev.join(', ')} → npm run prisma:migrate:deploy\n` : '') +
        (extraInDev.length ? `  Solo en desarrollo: ${extraInDev.join(', ')} → aplícalas en producción o resetea desarrollo\n` : ''),
    );
  }
  process.stdout.write(`  ${productionMigrations.length} migraciones iguales en ambas.\n`);

  const backupsDir = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const dumpFile = path.join(backupsDir, `prod-data-${stamp}.sql`);

  process.stdout.write(`Copiando datos de producción (pg_dump, solo lectura) a ${dumpFile}...\n`);
  await runInPg(
    production,
    'pg_dump "$DB_URL" --data-only --schema=public --exclude-table=public._prisma_migrations --no-owner --no-privileges',
    { stdoutFile: dumpFile },
  );
  process.stdout.write(`  ${(fs.statSync(dumpFile).size / 1024).toFixed(0)} KB.\n`);

  process.stdout.write('Reemplazando los datos de desarrollo (una sola transacción)...\n');
  const truncateAll = `
DO $$
DECLARE tables text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') INTO tables
  FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations';
  IF tables IS NOT NULL THEN EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE'; END IF;
END $$;
`;
  // pg_dump 17 emits `SET transaction_timeout`, unknown to Postgres < 17 (Supabase may run 15/16).
  const data = fs.readFileSync(dumpFile, 'utf-8').replace(/^SET transaction_timeout = .*$/gm, '');
  await runInPg(development, 'psql "$DB_URL" -v ON_ERROR_STOP=1 --single-transaction -q', { stdinText: truncateAll + data });

  const counts = 'SELECT (SELECT count(*) FROM products) || \' productos, \' || (SELECT count(*) FROM orders) || \' pedidos, \' || (SELECT count(*) FROM cash_sessions) || \' sesiones de caja, \' || (SELECT count(*) FROM users) || \' usuarios\'';
  const [productionCounts, developmentCounts] = await Promise.all([runInPg(production, psqlQuery(counts)), runInPg(development, psqlQuery(counts))]);
  process.stdout.write(`\nProducción: ${productionCounts.trim()}\nDesarrollo: ${developmentCounts.trim()}\n`);
  process.stdout.write('\nListo. Para las imágenes: npm run storage:copy-to-dev\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`\nError: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
