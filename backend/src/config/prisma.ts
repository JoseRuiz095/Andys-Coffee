import "./env";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { logger } from "../utils/logger";

// The DATABASE_URL is used for the connection pool in production.
// It should be configured with a secure SSL mode (e.g., sslmode=require).
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  logger.error("FATAL: DATABASE_URL is not defined in the environment variables.");
  throw new Error("DATABASE_URL must be defined for the application to connect to the database.");
}

// Ensure a secure SSL mode is configured for the database connection.
const sslModeMatch = databaseUrl.match(/[?&]sslmode=([^&]*)/);
const sslMode = sslModeMatch ? sslModeMatch[1]?.toLowerCase() : null;

if (!sslMode || !['require', 'verify-ca', 'verify-full'].includes(sslMode)) {
  logger.error(
    "FATAL: Insecure or missing database SSL configuration. 'sslmode' must be set to a secure value (e.g., 'require', 'verify-ca', 'verify-full')."
  );
  throw new Error(
    "Database connection must use SSL. Please configure DATABASE_URL with a secure sslmode."
  );
}

const databaseUrlForPool = new URL(databaseUrl);
databaseUrlForPool.searchParams.delete("sslmode");

const certificatePath = process.env.DATABASE_SSL_CA_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_SSL_CA_PATH)
  // Relative to the working directory (backend/): __dirname does not exist in this ESM package.
  : path.resolve(process.cwd(), "certs/prod-ca-2021.crt");
const certificateAuthority = process.env.DATABASE_SSL_CA || fs.readFileSync(certificatePath, "utf8");

const pool = new Pool({
  connectionString: databaseUrlForPool.toString(),
  ssl: {
    rejectUnauthorized: true,
    ca: certificateAuthority,
  },
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});

logger.info("Prisma client configured with database connection pooling.");