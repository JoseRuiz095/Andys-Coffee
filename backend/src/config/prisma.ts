import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Database connection URL is missing.");
}

const normalizedDatabaseUrl = databaseUrl.includes("sslmode=require")
  ? databaseUrl.replace("sslmode=require", "sslmode=disable")
  : databaseUrl;

const pool = new Pool({
  connectionString: normalizedDatabaseUrl,
  ssl: false,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});