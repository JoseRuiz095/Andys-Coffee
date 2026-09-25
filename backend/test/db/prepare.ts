/**
 * Generates the Prisma client, then applies all migrations and the seed to the local test
 * database. Run with `npm run test:db:prepare` (after `npm run test:db:up`).
 * Generating here matters on a fresh `npm ci` (CI): until then @prisma/client is an empty
 * stub and the seed, integration and E2E tests fail to import its enums.
 */
import '../setup/test-env';
import { execSync } from 'node:child_process';

const run = (command: string) => execSync(command, { stdio: 'inherit', env: process.env });

run('npx prisma generate');
run('npx prisma migrate deploy');
run('npx tsx prisma/seed.ts');
