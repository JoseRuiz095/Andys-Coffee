import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { assertOperationalResetAllowed, databaseHostOf, shouldSeedCatalog } from "../prisma/seed-guards";

// S-1/S-2/S-3 (estabilización 2026-11-14): nothing that drops or overwrites data runs against
// the production database by mistake.

const backendRoot = process.cwd();

/** Loads prisma.config.ts as the Prisma CLI would for `prisma <args>`; returns the error text or "". */
function loadPrismaConfig(args: string[], env: NodeJS.ProcessEnv): string {
  const code = `process.argv = [process.argv[0], "prisma", ${args.map((a) => JSON.stringify(a)).join(", ")}]; await import("./prisma.config.ts");`;
  try {
    execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: "postgresql://u:p@localhost:5432/coffee?sslmode=require", DIRECT_URL: undefined, ...env },
      encoding: "utf8",
      stdio: "pipe",
    });
    return "";
  } catch (error) {
    return String((error as { stderr?: string }).stderr ?? error);
  }
}

test("S-1: prisma.config bloquea migrate reset, migrate dev y db push en producción", () => {
  for (const args of [["migrate", "reset"], ["migrate", "dev"], ["db", "push"]]) {
    assert.match(loadPrismaConfig(args, { NODE_ENV: "production" }), /no se ejecuta contra producción/, args.join(" "));
  }
  // migrate deploy (the only production path) stays allowed.
  assert.equal(loadPrismaConfig(["migrate", "deploy"], { NODE_ENV: "production" }), "");
});

test("S-2: el seed no sobrescribe el catálogo de producción salvo SEED_CATALOG=true", () => {
  assert.equal(shouldSeedCatalog({ envMode: "development", usesProductionDatabase: false }), true);
  assert.equal(shouldSeedCatalog({ envMode: "test", usesProductionDatabase: false }), true);
  assert.equal(shouldSeedCatalog({ envMode: "production", usesProductionDatabase: false }), false);
  assert.equal(shouldSeedCatalog({ envMode: "development", usesProductionDatabase: true }), false);
  assert.equal(shouldSeedCatalog({ envMode: "production", usesProductionDatabase: false, seedCatalogFlag: "true" }), true);
});

test("S-3: limpiar datos operativos de producción exige --yes y escribir el host", () => {
  const prod = { envMode: "production", usesProductionDatabase: false, databaseHost: "db.prod.example.com" };
  assert.throws(() => assertOperationalResetAllowed({ ...prod, argv: [] }), /--yes/);
  assert.throws(() => assertOperationalResetAllowed({ ...prod, argv: ["--yes"] }), /PRODUCCIÓN/);
  assert.throws(() => assertOperationalResetAllowed({ ...prod, argv: ["--yes", "--confirm-host=otro"] }), /PRODUCCIÓN/);
  assert.doesNotThrow(() => assertOperationalResetAllowed({ ...prod, argv: ["--yes", "--confirm-host=db.prod.example.com"] }));
  // A development .env pointing at production is treated as production.
  assert.throws(() => assertOperationalResetAllowed({ ...prod, envMode: "development", usesProductionDatabase: true, argv: ["--yes"] }), /PRODUCCIÓN/);
  // The dev database only needs --yes.
  assert.doesNotThrow(() => assertOperationalResetAllowed({ envMode: "development", usesProductionDatabase: false, databaseHost: "localhost", argv: ["--yes"] }));
});

test("databaseHostOf extrae solo el host", () => {
  assert.equal(databaseHostOf("postgresql://user:secret@db.example.com:5432/app?sslmode=require"), "db.example.com");
  assert.equal(databaseHostOf(undefined), null);
  assert.equal(databaseHostOf("no es una url"), null);
});
