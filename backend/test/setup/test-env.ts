/**
 * Environment for integration tests and the test-database scripts.
 *
 * Loaded with `--import` BEFORE any app module, so these values win over backend/.env
 * (dotenv never overrides variables that are already set). It points everything at the
 * local Docker database from test/db/docker-compose.yml and refuses to run against any
 * non-local host, so integration tests can never write to the real (Supabase) database.
 */

const TEST_DB_PORT = process.env.TEST_DB_PORT ?? '55432';
const TEST_DB_NAME = 'andys_test';
const TEST_DB_CREDENTIALS = 'andys:andys_test_password';

const testEnv: Record<string, string> = {
  NODE_ENV: 'test',
  RUN_INTEGRATION_TESTS: 'true',
  // App connection: TLS verified against the local test CA, same code path as production.
  DATABASE_URL: `postgresql://${TEST_DB_CREDENTIALS}@localhost:${TEST_DB_PORT}/${TEST_DB_NAME}?sslmode=verify-full`,
  DATABASE_SSL_CA_PATH: 'test/db/certs/ca.crt',
  // Prisma CLI (migrate deploy): plain connection to the same local database.
  DIRECT_URL: `postgresql://${TEST_DB_CREDENTIALS}@localhost:${TEST_DB_PORT}/${TEST_DB_NAME}?sslmode=disable`,
  JWT_SECRET: 'integration-test-jwt-secret-0123456789-abcdefXYZ',
  CSRF_SECRET: 'integration-test-csrf-secret-32c',
  CASH_TIMEZONE: 'America/Mexico_City',
  CORS_ORIGINS: 'http://localhost:5173',
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'integration-test-anon-key',
  ADMIN_SEED_PASSWORD: 'IntegrationAdmin123!',
  ENABLE_CASH_AUTO_CLOSE: 'false',
  ENABLE_CASH_RECONCILIATION: 'false',
  LOG_LEVEL: 'warn',
};

for (const [key, value] of Object.entries(testEnv)) {
  process.env[key] = value;
}

for (const key of ['DATABASE_URL', 'DIRECT_URL'] as const) {
  const host = new URL(process.env[key]!).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`Refusing to run tests: ${key} points to "${host}", not a local test database.`);
  }
}

export {};
