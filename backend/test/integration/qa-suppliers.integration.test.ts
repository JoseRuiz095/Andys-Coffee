import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { QaHarness, integrationEnabled, qaIngredient, key, type QaUser } from "./qa-http";

// QA audit 2026-11-18 — Proveedores.

const h = new QaHarness();
const skip = !integrationEnabled;
let admin: QaUser;
let cashier: QaUser;

const create = (body: Record<string, unknown>, auth: QaUser = admin) => h.req("POST", "/api/suppliers", { auth, body });

before(async () => {
  if (skip) return;
  await h.start();
  admin = await h.user("admin", "ADMIN");
  cashier = await h.user("cajero", "CAJERO");
});

after(async () => {
  if (skip) return;
  await h.stop();
});

test("QA-PRV-01 registrar, consultar, buscar y editar contacto (teléfono, correo, dirección)", { skip }, async () => {
  const res = await create({ name: h.tag("Lácteos Norte"), phone: "667 123 4567", email: "ventas@lacteos.mx", address: "Calle 1" });
  assert.equal(res.status, 201, res.text);
  const id = res.json.supplier.id;
  assert.equal((await h.req("GET", `/api/suppliers/${id}`, { auth: cashier })).status, 200, "inventory.view puede consultar");
  const search = await h.req("GET", `/api/suppliers/search?q=${encodeURIComponent(h.tag("Lácteos"))}`, { auth: admin });
  assert.ok(search.text.includes(id));
  const patch = await h.req("PATCH", `/api/suppliers/${id}`, { auth: admin, body: { phone: "667 765 4321", email: "compras@lacteos.mx", address: "Calle 2" } });
  assert.equal(patch.status, 200, patch.text);
  const row = await prisma.supplier.findUniqueOrThrow({ where: { id } });
  assert.deepEqual([row.phone, row.email, row.address], ["667 765 4321", "compras@lacteos.mx", "Calle 2"]);
  const list = await h.req("GET", "/api/suppliers?limit=100", { auth: admin });
  assert.ok(list.json.data.some((s: { id: string }) => s.id === id));
});

test("QA-PRV-02 campos obligatorios e información incorrecta → 400", { skip }, async () => {
  for (const [label, body] of [
    ["sin nombre", { phone: "1" }],
    ["nombre vacío", { name: "" }],
    ["nombre en blanco", { name: "   " }],
    ["correo inválido", { name: h.tag("mailbad"), email: "no-es-correo" }],
    ["nombre larguísimo", { name: "x".repeat(300) }],
  ] as const) {
    const res = await create(body);
    assert.equal(res.status, 400, `${label} → ${res.status}`);
  }
  const blankEdit = await create({ name: h.tag("blank-edit") });
  const edit = await h.req("PATCH", `/api/suppliers/${blankEdit.json.supplier.id}`, { auth: admin, body: { name: "   " } });
  const stored = (await prisma.supplier.findUniqueOrThrow({ where: { id: blankEdit.json.supplier.id } })).name;
  assert.equal(edit.status, 400, `editar nombre "   " → ${edit.status}, guardado ${JSON.stringify(stored)}`);
});

test("QA-PRV-03 teléfono con letras se rechaza", { skip }, async () => {
  const res = await create({ name: h.tag("tel"), phone: "llámame mañana" });
  assert.equal(res.status, 400, `teléfono "llámame mañana" → ${res.status}`);
});

test("QA-PRV-04 duplicados por nombre (mayúsculas/espacios) → 409, al crear y al renombrar", { skip }, async () => {
  const name = h.tag("Café del Valle");
  const first = await create({ name });
  assert.equal(first.status, 201);
  assert.equal((await create({ name: `  ${name.toUpperCase()}  ` })).status, 409);
  const other = await create({ name: h.tag("otro") });
  const rename = await h.req("PATCH", `/api/suppliers/${other.json.supplier.id}`, { auth: admin, body: { name: name.toLowerCase() } });
  assert.equal(rename.status, 409);
});

test("QA-PRV-05 alta concurrente del mismo proveedor: queda uno solo", { skip }, async () => {
  const name = h.tag("Concurrente SA");
  const results = await Promise.all(Array.from({ length: 5 }, () => create({ name })));
  const count = await prisma.supplier.count({ where: { name } });
  assert.equal(count, 1, `proveedores creados: ${count} (estados ${results.map((r) => r.status).join(",")})`);
});

test("QA-PRV-06 con compras: no se elimina; se desactiva y el historial de compras se conserva", { skip }, async () => {
  const s = (await create({ name: h.tag("con compras") })).json.supplier;
  const ing = await qaIngredient(h, "prv-ing", 0);
  const purchase = await h.req("POST", "/api/purchases", { auth: admin, headers: { "X-Idempotency-Key": key() }, body: { supplierId: s.id, items: [{ ingredientId: ing.id, quantity: 2, unitCost: 10 }] } });
  assert.equal(purchase.status, 201, purchase.text);
  const del = await h.req("DELETE", `/api/suppliers/${s.id}`, { auth: admin });
  assert.equal(del.status, 409);
  assert.equal((await h.req("PATCH", `/api/suppliers/${s.id}/active`, { auth: admin, body: { isActive: false } })).status, 200);
  const p = await h.req("GET", `/api/purchases/${purchase.json.purchase.id}`, { auth: admin });
  assert.equal(p.status, 200);
  assert.equal(p.json.supplierId ?? p.json.supplier?.id, s.id);
  const inactive = await h.req("GET", "/api/suppliers?isActive=false&limit=100", { auth: admin });
  assert.ok(inactive.text.includes(s.id));
  const clean = (await create({ name: h.tag("sin compras") })).json.supplier;
  assert.equal((await h.req("DELETE", `/api/suppliers/${clean.id}`, { auth: admin })).status, 200);
  assert.equal((await h.req("DELETE", `/api/suppliers/${clean.id}`, { auth: admin })).status, 404);
});

test("QA-PRV-07 un proveedor desactivado no se puede usar en una compra nueva", { skip }, async () => {
  const s = (await create({ name: h.tag("inactivo") })).json.supplier;
  await h.req("PATCH", `/api/suppliers/${s.id}/active`, { auth: admin, body: { isActive: false } });
  const ing = await qaIngredient(h, "prv-ing2", 0);
  const res = await h.req("POST", "/api/purchases", { auth: admin, headers: { "X-Idempotency-Key": key() }, body: { supplierId: s.id, items: [{ ingredientId: ing.id, quantity: 1, unitCost: 1 }] } });
  assert.ok(res.status >= 400 && res.status < 500, `compra con proveedor inactivo → ${res.status}`);
});

test("QA-PRV-08 compra con proveedor inexistente → 4xx", { skip }, async () => {
  const ing = await qaIngredient(h, "prv-ing3", 0);
  const res = await h.req("POST", "/api/purchases", { auth: admin, headers: { "X-Idempotency-Key": key() }, body: { supplierId: "00000000-0000-4000-8000-000000000000", items: [{ ingredientId: ing.id, quantity: 1, unitCost: 1 }] } });
  assert.ok(res.status >= 400 && res.status < 500, `→ ${res.status}`);
});

test("QA-PRV-09 permisos: CAJERO consulta pero no crea, edita, desactiva ni elimina", { skip }, async () => {
  const s = (await create({ name: h.tag("permisos") })).json.supplier;
  assert.equal((await create({ name: h.tag("cajero-crea") }, cashier)).status, 403);
  assert.equal((await h.req("PATCH", `/api/suppliers/${s.id}`, { auth: cashier, body: { phone: "1" } })).status, 403);
  assert.equal((await h.req("PATCH", `/api/suppliers/${s.id}/active`, { auth: cashier, body: { isActive: false } })).status, 403);
  assert.equal((await h.req("DELETE", `/api/suppliers/${s.id}`, { auth: cashier })).status, 403);
  assert.equal((await h.req("GET", `/api/suppliers/search?q=a`, { auth: admin })).status, 400, "búsqueda < 2 caracteres");
});
