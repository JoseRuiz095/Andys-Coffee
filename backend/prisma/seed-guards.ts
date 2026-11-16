/**
 * Guards for the scripts that write data in bulk (seed, operational reset). Pure functions so
 * they can be unit tested without a database.
 */

interface TargetDatabase {
  /** NODE_ENV the script runs with (`ENV_MODE`). */
  envMode: string;
  /** A non-production mode pointing at the production database (`USES_PRODUCTION_DATABASE`). */
  usesProductionDatabase: boolean;
}

/** True when the script is about to write into the production database. */
export function targetsProduction({ envMode, usesProductionDatabase }: TargetDatabase): boolean {
  return envMode === "production" || usesProductionDatabase;
}

/**
 * The catalog step of the seed overwrites categories, products, prices and extras and deletes
 * every promotion. Against production it only runs when asked for explicitly
 * (SEED_CATALOG=true); roles, permissions, the admin user and default preferences are always
 * safe upserts.
 */
export function shouldSeedCatalog(target: TargetDatabase & { seedCatalogFlag?: string }): boolean {
  if (!targetsProduction(target)) return true;
  return target.seedCatalogFlag?.trim().toLowerCase() === "true";
}

/**
 * The operational reset TRUNCATEs sales, cash, expenses and movements. Against production the
 * operator must also type the database host (`--confirm-host=<host>`), so a wrong
 * NODE_ENV or a .env pointing at production can't empty it by accident.
 */
export function assertOperationalResetAllowed(
  target: TargetDatabase & { argv: string[]; databaseHost: string | null },
): void {
  if (!target.argv.includes("--yes")) {
    throw new Error("Esto BORRA ventas, cajas, gastos, compras y movimientos de la BD. Vuelve a ejecutar con --yes.");
  }
  if (!targetsProduction(target)) return;
  const confirmed = target.argv.find((arg) => arg.startsWith("--confirm-host="))?.slice("--confirm-host=".length);
  if (!target.databaseHost || confirmed !== target.databaseHost) {
    throw new Error(
      "Esta es la base de datos de PRODUCCIÓN. Haz un respaldo y confirma escribiendo su host: " +
        "--confirm-host=<host de la BD> (el que aparece en DATABASE_URL después de la @).",
    );
  }
}

/** Host of a PostgreSQL URL (no user, password nor database), or null. */
export function databaseHostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}
