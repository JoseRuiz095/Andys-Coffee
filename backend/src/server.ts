import { ENV_FILE, ENV_FILE_LOADED, ENV_MODE, ENV_OVERRIDDEN_KEYS, USES_PRODUCTION_DATABASE, databaseIdentity } from "./config/env";
import { app } from "./app";
import { logger } from "./utils/logger";
import { PORT as port } from "./config/app";
import { scheduleCashAutoClose } from "./jobs/cashAutoClose.job";
import { scheduleCashReconciliation } from "./jobs/cashReconciliation.job";
import { scheduleScheduledOrders } from "./jobs/orderScheduled.job";
import cron from "node-cron";
import { checkDatabaseConnection, disconnectDatabase } from "./config/prisma";
import { ReadinessService } from "./services/readiness.service";

/**
 * User, host and database of DATABASE_URL, never the password. The user carries the Supabase
 * project ref (`postgres.<ref>`): the pooler host alone does not tell two projects apart.
 */
function describeDatabase(url: string | undefined): string {
  if (!url) return "sin DATABASE_URL";
  return databaseIdentity(url) ?? "DATABASE_URL inválida";
}

function logEnvironment() {
  const isProduction = ENV_MODE === "production";
  logger.info(
    {
      mode: ENV_MODE,
      envFile: ENV_FILE_LOADED ? ENV_FILE : `${ENV_FILE} (no existe; solo variables del entorno)`,
      database: describeDatabase(process.env.DATABASE_URL),
    },
    isProduction ? "Modo PRODUCCIÓN" : `Modo ${ENV_MODE.toUpperCase()}`,
  );
  if (USES_PRODUCTION_DATABASE) {
    logger.error(
      { mode: ENV_MODE },
      "Este modo apunta a la base de datos de PRODUCCIÓN (la misma de .env.production): todo lo que hagas aquí cambia datos reales",
    );
  }
  if (ENV_OVERRIDDEN_KEYS.length > 0) {
    logger.warn(
      { keys: ENV_OVERRIDDEN_KEYS },
      "Estas variables vienen del entorno de la terminal y no del archivo .env: revisa que sea intencional",
    );
  }
}

const server = app.listen(port, () => {
  logEnvironment();
  logger.info({ port, healthCheck: `http://localhost:${port}/health` }, "Backend listo");
  void checkDatabaseConnection();
  void ReadinessService.warnIfSchemaOutdated();
  scheduleCashAutoClose();
  scheduleCashReconciliation();
  scheduleScheduledOrders();
});

server.on("error", (error) => {
  logger.error({ errorName: error.name, errorCode: (error as NodeJS.ErrnoException).code }, "Error del servidor");
});
/**
 * C1 (2026-11-14): a redeploy sends SIGTERM. Stop accepting requests, let the in-flight ones
 * (and their transactions) finish, stop the cron jobs and close the database pool, instead of
 * cutting everything mid-write. Forced exit after 10 s.
 */
function shutdown(signal: string) {
  logger.info({ signal }, "Cerrando el backend…");
  const forced = setTimeout(() => process.exit(1), 10_000);
  forced.unref();
  for (const task of cron.getTasks().values()) task.stop();
  server.close(async () => {
    await disconnectDatabase();
    logger.info("Backend cerrado");
    process.exit(0);
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
