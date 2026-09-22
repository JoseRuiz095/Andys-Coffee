/**
 * Applies all migrations and the seed to the local test database.
 * Run with `npm run test:db:prepare` (after `npm run test:db:up`).
 */
import '../setup/test-env';
import { execSync } from 'node:child_process';

const run = (command: string) => execSync(command, { stdio: 'inherit', env: process.env });

run('npx prisma migrate deploy');
run('npx tsx prisma/seed.ts');
