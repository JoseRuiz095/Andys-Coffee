import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { QaHarness, integrationEnabled, key, type QaUser } from "./qa-http";

// Producción conserva los ids de texto del catálogo original: insumos `PROD-001…` y proveedores
// `PROV-01…` (respaldo del 2026-10-03: 117 de 119 insumos y 15 de 17 proveedores). Cada flujo de
// inventario tiene que aceptarlos igual que a un uuid.
//
// Con LEGACY_BACKUP=<ruta a un respaldo .sql de producción> usa la lista real de insumos y
// proveedores (ids, nombres y unidades). Sin él (CI) genera insumos y proveedores con ese formato.

const h = new QaHarness();
const skip = !integrationEnabled;
let admin: QaUser;

type Row = Record<string, string>;
function copyRows(sql: string, table: string): Row[] {
  const match = new RegExp(`^COPY public\\.${table} \\(([^)]*)\\) FROM stdin;\\r?\\n([\\s\\S]*?)^\\\\\\.`, "m").exec(sql);
  if (!match) return [];
  const cols = match[1].split(",").map((c) => c.trim().replace(/"/g, ""));
  return match[2].split(/\r?\n/).filter(Boolean).map((line) => Object.fromEntries(line.split("\t").map((v, i) => [cols[i], v])));
}

type Fixture = { id: string; name: string; unitAbbr: string };
const ingredients: Fixture[] = [];
const suppliers: { id: string; name: string }[] = [];

before(async () => {
  if (skip) return;
  await h.start();
  admin = await h.user("admin", "ADMIN");
  const units = new Map((await prisma.inventoryUnit.findMany()).map((u) => [u.abbreviation, u.id]));

  const backup = process.env.LEGACY_BACKUP;
  if (backup && fs.existsSync(backup)) {
    const sql = fs.readFileSync(path.resolve(backup), "utf8");
    const unitAbbr = new Map(copyRows(sql, "inventory_units").map((u) => [u.id, u.abbreviation]));
    for (const r of copyRows(sql, "ingredients")) {
      if (r.isActive !== "t" || r.deletedAt !== "\\N") continue;
      ingredients.push({ id: r.id, name: r.name, unitAbbr: unitAbbr.get(r.unitId) ?? "gr" });
    }
    for (const r of copyRows(sql, "suppliers")) if (r.isActive === "t") suppliers.push({ id: r.id, name: r.name });
  } else {
    ["gr", "ml", "pz"].forEach((abbr, i) => ingredients.push({ id: `PROD-9${h.id.slice(0, 2)}${i}`, name: h.tag(`legacy-${abbr}`), unitAbbr: abbr }));
    suppliers.push({ id: `PROV-9${h.id.slice(0, 3)}`, name: h.tag("legacy-supplier") });
  }

  for (const f of ingredients) {
    const unitId = units.get(f.unitAbbr) ?? units.get("gr")!;
    await prisma.ingredient.upsert({ where: { id: f.id }, update: { isActive: true, deletedAt: null }, create: { id: f.id, name: f.name, unitId, currentStock: 1000 } });
  }
  for (const s of suppliers) await prisma.supplier.upsert({ where: { id: s.id }, update: { isActive: true }, create: { id: s.id, name: s.name } });
});

after(async () => {
  if (skip) return;
  const ids = ingredients.map((i) => i.id);
  await prisma.inventoryCount.deleteMany({ where: { createdById: admin.id } });
  await prisma.inventoryMovement.deleteMany({ where: { ingredientId: { in: ids } } });
  await prisma.purchase.deleteMany({ where: { createdById: admin.id } });
  await prisma.ingredient.deleteMany({ where: { id: { in: ids } } });
  await prisma.supplier.deleteMany({ where: { id: { in: suppliers.map((s) => s.id) } } });
  await h.stop();
});

/** Runs `attempt` for every fixture and fails listing each one that did not answer `expected`. */
async function forEach<T extends { id: string; name: string }>(rows: T[], expected: number, attempt: (row: T) => Promise<{ status: number; json?: any }>) {
  const failures: string[] = [];
  for (const row of rows) {
    const res = await attempt(row);
    if (res.status !== expected) failures.push(`${row.id} ${row.name} → ${res.status} ${res.json?.message ?? ""} ${JSON.stringify(res.json?.errors ?? {})}`);
  }
  assert.deepEqual(failures, [], `${failures.length} de ${rows.length} fallaron:\n${failures.join("\n")}`);
}

const purchase = (body: unknown) => h.req("POST", "/api/purchases", { auth: admin, headers: { "X-Idempotency-Key": key() }, body });

test("LEG-01 una compra (borrador) de cada insumo", { skip }, async () => {
  await forEach(ingredients, 201, (i) => purchase({ items: [{ ingredientId: i.id, quantity: "10", unitCost: "1.5" }] }));
});

test("LEG-02 una compra con cada proveedor", { skip }, async () => {
  // Isolates the supplier: uses a uuid ingredient when the list has one.
  const first = ingredients.find((i) => /^[0-9a-f]{8}-/i.test(i.id)) ?? ingredients[0];
  await forEach(suppliers, 201, (s) => purchase({ supplierId: s.id, items: [{ ingredientId: first.id, quantity: "1", unitCost: "1" }] }));
});

test("LEG-03 recibir una compra de un insumo heredado con proveedor heredado", { skip }, async () => {
  const [a] = ingredients;
  const created = await purchase({ supplierId: suppliers[0].id, items: [{ ingredientId: a.id, quantity: "5", unitCost: "2" }] });
  assert.equal(created.status, 201, created.text);
  const id = created.json.purchase.id;
  const received = await h.req("POST", `/api/purchases/${id}/receive`, { auth: admin, headers: { "X-Idempotency-Key": key() } });
  assert.equal(received.status, 200, received.text);
});

test("LEG-04 una salida (merma) de cada insumo", { skip }, async () => {
  await forEach(ingredients, 201, (i) => h.req("POST", "/api/inventory/exits", { auth: admin, headers: { "X-Idempotency-Key": key() }, body: { ingredientId: i.id, quantity: "1", reason: "waste" } }));
});

test("LEG-05 contar cada insumo en un conteo físico", { skip }, async () => {
  const count = await h.req("POST", "/api/inventory-counts", { auth: admin, headers: { "X-Idempotency-Key": key() }, body: {} });
  assert.equal(count.status, 201, count.text);
  const countId = count.json.data.id;
  await forEach(ingredients, 200, (i) => h.req("POST", `/api/inventory-counts/${countId}/items`, { auth: admin, body: { ingredientId: i.id, countedQuantity: 5 } }));
});

test("LEG-06 filtrar los movimientos por un insumo heredado", { skip }, async () => {
  const res = await h.req("GET", `/api/inventory/movements?ingredientId=${encodeURIComponent(ingredients[0].id)}`, { auth: admin });
  assert.equal(res.status, 200, res.text);
});
