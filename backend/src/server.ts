import { ENV_FILE, ENV_FILE_LOADED, ENV_MODE, ENV_OVERRIDDEN_KEYS, USES_PRODUCTION_DATABASE } from "./config/env";
import { app } from "./app";
import { logger } from "./utils/logger";
import { PORT as port } from "./config/app";
import { scheduleCashAutoClose } from "./jobs/cashAutoClose.job";
import { scheduleCashReconciliation } from "./jobs/cashReconciliation.job";

/** Host and database of DATABASE_URL, never the credentials. */
function describeDatabase(url: string | undefined): string {
  if (!url) return "sin DATABASE_URL";
  try {
    const { hostname, port: dbPort, pathname } = new URL(url);
    return `${hostname}${dbPort ? `:${dbPort}` : ""}${pathname}`;
  } catch {
    return "DATABASE_URL inválida";
  }
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
  scheduleCashAutoClose();
  scheduleCashReconciliation();
});

server.on("error", (error) => {
  logger.error({ errorName: error.name, errorCode: (error as NodeJS.ErrnoException).code }, "Error del servidor");
});