/**
 * Connections to the two databases of the dev → prod sync scripts, read from .env.development
 * and .env.production (or `--source-env <file>` / `--target-env <file>` to rehearse against
 * other databases). Remote databases must use SSL verified with the Supabase CA; only a local
 * database (localhost, e.g. a Docker copy of production) may go without it.
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export type DatabaseRole = 'development' | 'production';

const backendRoot = process.cwd();

export function assertRunFromBackend() {
  if (!fs.existsSync(path.join(backendRoot, 'prisma/schema.prisma'))) {
    throw new Error('Ejecuta este comando desde backend/.');
  }
}

function envFileFor(mode: DatabaseRole) {
  const flag = mode === 'development' ? '--source-env' : '--target-env';
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? path.resolve(backendRoot, process.argv[index + 1]) : path.join(backendRoot, `.env.${mode}`);
}

const isLocalHost = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1';

export function readDatabaseConfig(mode: DatabaseRole) {
  const envPath = envFileFor(mode);
  if (!fs.existsSync(envPath)) throw new Error(`No existe ${path.basename(envPath)}.`);
  const env = dotenv.parse(fs.readFileSync(envPath));
  const rawUrl = env.DIRECT_URL || env.DATABASE_URL;
  if (!rawUrl) throw new Error(`${path.basename(envPath)} no define DIRECT_URL ni DATABASE_URL.`);

  const url = new URL(rawUrl);
  const local = isLocalHost(url.hostname);
  const sslmode = url.searchParams.get('sslmode');
  if (!local && (!sslmode || !['require', 'verify-ca', 'verify-full'].includes(sslmode))) {
    throw new Error(`${path.basename(envPath)} debe usar una conexión PostgreSQL con SSL.`);
  }
  for (const key of ['sslmode', 'pgbouncer', 'connection_limit', 'pool_timeout']) url.searchParams.delete(key);

  const identity = `${decodeURIComponent(url.username)}@${url.hostname}:${url.port || '5432'}${url.pathname}`;
  if (local && sslmode !== 'require' && sslmode !== 'verify-ca' && sslmode !== 'verify-full') {
    return { connectionString: url.toString(), ca: null, identity, hostname: url.hostname };
  }
  const caPath = env.DATABASE_SSL_CA_PATH
    ? path.resolve(backendRoot, env.DATABASE_SSL_CA_PATH)
    : path.join(backendRoot, 'certs/prod-ca-2021.crt');
  const ca = env.DATABASE_SSL_CA || fs.readFileSync(caPath, 'utf8');
  return { connectionString: url.toString(), ca, identity, hostname: url.hostname };
}

export function createDatabase(mode: DatabaseRole) {
  const config = readDatabaseConfig(mode);
  const pool = new Pool({
    connectionString: config.connectionString,
    ...(config.ca ? { ssl: { rejectUnauthorized: true, ca: config.ca } } : {}),
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { prisma, pool, identity: config.identity, hostname: config.hostname };
}

export async function appliedMigrations(db: PrismaClient) {
  return db.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name
    FROM _prisma_migrations
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ORDER BY migration_name
  `;
}
