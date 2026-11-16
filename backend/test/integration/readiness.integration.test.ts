import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { app } from "../../src/app";
import { SchemaRepository } from "../../src/repositories/schema.repository";
import { LATEST_REQUIRED_MIGRATION } from "../../src/config/migrations";

// D1 (estabilización 2026-11-14): /ready says whether the database has the schema this code needs.
const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
let server: Server;
let baseUrl: string;

before(async () => {
  if (!integrationEnabled) return;
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("/ready responde 200 cuando la BD tiene la última migración requerida", { skip: !integrationEnabled }, async () => {
  const res = await fetch(`${baseUrl}/ready`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
  assert.equal(await SchemaRepository.isMigrationApplied(LATEST_REQUIRED_MIGRATION), true);
});

test("una migración que no está aplicada se detecta (base de /ready → 503)", { skip: !integrationEnabled }, async () => {
  assert.equal(await SchemaRepository.isMigrationApplied("29991231000000_no_existe"), false);
});
