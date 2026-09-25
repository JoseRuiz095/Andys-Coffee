import "../../src/config/env";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required to run SEC-002 integration tests.",
  );
}

const sslModeMatch = databaseUrl.match(/[?&]sslmode=([^&]*)/);
const sslMode = sslModeMatch?.[1]?.toLowerCase();

const caPath = process.env.DATABASE_SSL_CA_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_SSL_CA_PATH)
  : path.resolve(process.cwd(), "certs/prod-ca-2021.crt");

const ca = process.env.DATABASE_SSL_CA
  ? process.env.DATABASE_SSL_CA
  : fs.readFileSync(caPath, "utf8");

function createPool(
  url: string,
  ssl: {
    rejectUnauthorized: boolean;
    ca?: string;
  },
) {
  const parsedUrl = new URL(url);

  // sslmode is validated by the application configuration.
  // pg receives the TLS configuration explicitly.
  parsedUrl.searchParams.delete("sslmode");

  return new Pool({
    connectionString: parsedUrl.toString(),
    ssl,
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 1_000,
  });
}

const pools: Pool[] = [];

after(async () => {
  await Promise.all(
    pools.map(async (pool) => {
      await pool.end().catch(() => undefined);
    }),
  );
});

test("SEC-002: DATABASE_URL exige sslmode seguro", () => {
  assert.ok(
    sslMode,
    "DATABASE_URL debe especificar sslmode.",
  );

  assert.ok(
    ["require", "verify-ca", "verify-full"].includes(sslMode!),
    `sslmode inseguro: ${sslMode}`,
  );
});

test("SEC-002: PostgreSQL acepta una conexión TLS con la CA configurada", async () => {
  const pool = createPool(databaseUrl, {
    rejectUnauthorized: true,
    ca,
  });

  pools.push(pool);

  const result = await pool.query<{
    result: number;
    ssl: boolean;
  }>(`
    SELECT
      1 AS result,
      (
        SELECT ssl
        FROM pg_stat_ssl
        WHERE pid = pg_backend_pid()
      ) AS ssl
  `);

  assert.equal(result.rows[0]?.result, 1);

  assert.equal(
    result.rows[0]?.ssl,
    true,
    "La conexión PostgreSQL debe utilizar TLS.",
  );
});

test("SEC-002: PostgreSQL rechaza una CA inválida", async () => {
  const invalidCa = [
    "-----BEGIN CERTIFICATE-----",
    "INVALID-CA-FOR-SEC-002",
    "-----END CERTIFICATE-----",
  ].join("\n");

  const pool = createPool(databaseUrl, {
    rejectUnauthorized: true,
    ca: invalidCa,
  });

  pools.push(pool);

  await assert.rejects(
    () => pool.query("SELECT 1"),
    (error: unknown) => {
      assert.ok(error instanceof Error);

      const message = error.message.toLowerCase();

      return (
        message.includes("certificate") ||
        message.includes("unable to verify") ||
        message.includes("self-signed") ||
        message.includes("unable to get local issuer") ||
        message.includes("tls")
      );
    },
  );
});