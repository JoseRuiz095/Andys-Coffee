import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/**
 * Loads backend/.env.<NODE_ENV> (".env.development" unless NODE_ENV says otherwise).
 * Import it before anything that reads process.env: the app entry points, the Prisma
 * config, the seed and the scripts already do.
 *
 * NODE_ENV has to be set by the process that starts the app (`npm run start`,
 * `npm run prisma:migrate:deploy:prod`, `cross-env NODE_ENV=production …`) — the file is
 * chosen from it, so a NODE_ENV written inside the file cannot pick the file.
 * Variables already present in the environment always win (dotenv never overrides them):
 * that is how the test setup and hosting platforms inject their own values.
 */
export const ENV_MODE = process.env.NODE_ENV?.trim() || "development";

/** backend/: the nearest folder (from the working directory up) with prisma.config.ts, or ./backend. */
function findBackendRoot(start: string): string {
  for (let dir = start; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "prisma.config.ts"))) return dir;
    if (fs.existsSync(path.join(dir, "backend", "prisma.config.ts"))) return path.join(dir, "backend");
    if (path.dirname(dir) === dir) return start;
  }
}

const backendRoot = findBackendRoot(process.cwd());
export const ENV_FILE = path.join(backendRoot, `.env.${ENV_MODE}`);

/** Variables that were already in the environment, so the file could not set them. */
export const ENV_OVERRIDDEN_KEYS: string[] = [];
export const ENV_FILE_LOADED = fs.existsSync(ENV_FILE);

if (ENV_FILE_LOADED) {
  const { parsed = {} } = dotenv.config({ path: ENV_FILE, quiet: true });
  // dotenv returns the file's values even when the environment kept its own.
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] !== value) ENV_OVERRIDDEN_KEYS.push(key);
  }
}

// The file normally repeats NODE_ENV; if it doesn't (or it was set empty), keep the mode
// that selected it.
if (!process.env.NODE_ENV?.trim()) process.env.NODE_ENV = ENV_MODE;

/**
 * `user@host:port/database` of a connection string (no password). Supabase poolers share the
 * host between projects, so the user (`postgres.<project-ref>`) is what tells them apart.
 */
export function databaseIdentity(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { username, hostname, port, pathname } = new URL(url);
    return `${decodeURIComponent(username)}@${hostname}:${port || "5432"}${pathname}`;
  } catch {
    return null;
  }
}

/**
 * True when a non-production mode is configured against the production database (the one in
 * .env.production). Used to warn at startup and to block destructive Prisma commands.
 */
export const USES_PRODUCTION_DATABASE: boolean = (() => {
  if (ENV_MODE === "production") return false;
  const productionFile = path.join(backendRoot, ".env.production");
  if (!fs.existsSync(productionFile)) return false;
  const production = dotenv.parse(fs.readFileSync(productionFile));
  const productionIds = [production.DATABASE_URL, production.DIRECT_URL].map(databaseIdentity).filter(Boolean);
  const currentIds = [process.env.DATABASE_URL, process.env.DIRECT_URL].map(databaseIdentity).filter(Boolean);
  return currentIds.some((id) => productionIds.includes(id));
})();
