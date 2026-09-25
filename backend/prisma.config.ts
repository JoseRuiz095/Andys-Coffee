// Same env file as the app: .env.<NODE_ENV> (development unless NODE_ENV says otherwise).
import { ENV_MODE, USES_PRODUCTION_DATABASE } from "./src/config/env";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL must be configured for Prisma.");
}

// Commands that drop data or rewrite the schema without a reviewed migration.
const [command, subcommand] = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const destructive =
  (command === "migrate" && (subcommand === "dev" || subcommand === "reset")) ||
  (command === "db" && subcommand === "push");

if (destructive && ENV_MODE === "production" && !(command === "migrate" && subcommand === "reset")) {
  throw new Error(`"prisma ${command} ${subcommand}" no se ejecuta contra producción: usa "npm run prisma:migrate:deploy:prod".`);
}
if (destructive && USES_PRODUCTION_DATABASE) {
  throw new Error(
    `"prisma ${command} ${subcommand}" bloqueado: el modo ${ENV_MODE} apunta a la base de datos de producción ` +
      "(la misma de .env.production). Configura una BD propia en .env.development.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },

  datasource: {
    url: databaseUrl,
  },
});