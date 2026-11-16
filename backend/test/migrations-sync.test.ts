import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { LATEST_REQUIRED_MIGRATION } from "../src/config/migrations";

// D1 (estabilización 2026-11-14): /ready compares the database with LATEST_REQUIRED_MIGRATION,
// so it must always name the newest migration folder.
test("LATEST_REQUIRED_MIGRATION es la migración más reciente de prisma/migrations", () => {
  const dir = join(process.cwd(), "prisma", "migrations");
  const migrations = readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory()).sort();
  assert.equal(LATEST_REQUIRED_MIGRATION, migrations[migrations.length - 1]);
});
