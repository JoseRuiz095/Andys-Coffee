/**
 * Generates the Prisma client, then applies all migrations and the seed to the local test
 * database. Run with `npm run test:db:prepare` (after `npm run test:db:up`).
 * Generating here matters on a fresh `npm ci` (CI): until then @prisma/client is an empty
 * stub and the seed, integration and E2E tests fail to import its enums.
 */
import '../setup/test-env';
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

const testEnv = {
  ...process.env,
  NODE_ENV: 'test',
  RUN_INTEGRATION_TESTS: 'true',
  DATABASE_URL: 'postgresql://andys:andys_test_password@localhost:55432/andys_test?sslmode=verify-full',
  DIRECT_URL: 'postgresql://andys:andys_test_password@localhost:55432/andys_test?sslmode=disable',
  DATABASE_SSL_CA_PATH: 'test/db/certs/ca.crt',
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

const run = (command: string) => execSync(command, { stdio: 'inherit', env: testEnv });

if (process.platform === 'win32') {
  const script = `
    $currentPid = [int]$env:CURRENT_PID;
    Get-CimInstance Win32_Process -Filter "name='node.exe'" |
      Where-Object { $_.ProcessId -ne $currentPid } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue };
  `;

  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], {
    stdio: 'inherit',
    env: { ...testEnv, CURRENT_PID: String(process.pid) },
  });

  if (result.error) {
    console.warn('Could not clear stale Node processes:', result.error.message);
  }
}

const prismaClientDir = path.resolve(process.cwd(), 'node_modules/.prisma/client');
if (fs.existsSync(prismaClientDir)) {
  for (const entry of fs.readdirSync(prismaClientDir)) {
    if (entry.includes('.tmp') || entry.includes('query_engine-windows.dll.node.tmp')) {
      fs.rmSync(path.join(prismaClientDir, entry), { force: true });
    }
  }
}

run('npx prisma generate');
run('npx prisma migrate deploy');
run('npx tsx prisma/seed.ts');
