/**
 * Environment for unit tests (`npm run test:unit`).
 *
 * Loaded with `--import` BEFORE any app module. Unit tests import modules whose config is
 * validated at load time (Prisma pool, JWT, Supabase), but they never connect to anything,
 * so dummy values are enough. NODE_ENV=test means no backend/.env.* file is loaded: unit
 * tests behave the same on a developer machine and in CI (where those files and certs/ do
 * not exist).
 */

const unitEnv: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unit:unit@localhost:5432/unit?sslmode=require',
  DIRECT_URL: 'postgresql://unit:unit@localhost:5432/unit?sslmode=require',
  // Inline CA so src/config/prisma.ts does not read certs/ (never used: no connection is opened).
  DATABASE_SSL_CA: 'unit-test-ca',
  JWT_SECRET: 'unit-test-jwt-secret-0123456789-abcdefghijXYZ',
  CSRF_SECRET: 'unit-test-csrf-secret-0123456789',
  CASH_TIMEZONE: 'America/Mexico_City',
  CORS_ORIGINS: 'http://localhost:5173',
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'unit-test-anon-key',
  ENABLE_CASH_AUTO_CLOSE: 'false',
  ENABLE_CASH_RECONCILIATION: 'false',
  LOG_LEVEL: 'silent',
};

for (const [key, value] of Object.entries(unitEnv)) {
  process.env[key] = value;
}

export {};
