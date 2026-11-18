import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { QaHarness, integrationEnabled, openFreshCashSession, closeAnyCashSession, qaProduct, qaIngredient, sale, key, type QaUser } from "./qa-http";

// QA audit 2026-11-18 — Inventario: productos (catálogo) e ingredientes/insumos.

const h = new QaHarness();
const skip = !integrationEnabled;
let admin: QaUser;
let cashier: QaUser;
let categoryId: string;
let unitId: string;

before(async () => {
  if (skip) return;
  await h.start();
  admin = await h.user("admin", "ADMIN");
  cashier = await h.user("cajero", "CAJERO");
  categoryId = (await prisma.category.create({ data: { name: h.tag("cat-inv"), isBeverage: true } })).id;
  unitId = (await prisma.inventoryUnit.findFirstOrThrow({ where: { factor: 1, dimension: "MASS" } })).id;
});

after(async () => {
  if (skip) return;
  await closeAnyCashSession();
  await h.stop();
});

const newProduct = (overrides: Record<string, unknown> = {}) => ({
  name: h.tag(`prod-${Math.random().toString(36).slice(2, 7)}`), price: 50, cost: 12, categoryId, tracksInventory: false, ...overrides,
});

test("QA-INV-01 producto: crear, consultar, editar precio/categoría/SKU/temperatura y persistir", { skip }, async () => {
  const created = await h.req("POST", "/api/products", { auth: admin, body: newProduct({ sku: h.tag("SKU-1"), temperature: "BOTH", jumboPrice: 60 }) });
  assert.equal(created.status, 201, created.text);
  const id = created.json.id;
  const other = (await prisma.category.create({ data: { name: h.tag("cat-2") } })).id;
  const patch = await h.req("PATCH", `/api/products/${id}`, { auth: admin, body: { price: 55.5, categoryId: other, sku: h.tag("SKU-1b"), temperature: "COLD" } });
  assert.equal(patch.status, 200, patch.text);
  const row = await prisma.product.findUniqueOrThrow({ where: { id } });
  assert.equal(row.price.toFixed(2), "55.50");
  assert.equal(row.categoryId, other);
  assert.equal(row.sku, h.tag("SKU-1b"));
  assert.equal(row.temperature, "COLD");
  const got = await h.req("GET", `/api/products/${id}`, { auth: cashier });
  assert.equal(got.status, 200);
  const list = await h.req("GET", `/api/products?search=${encodeURIComponent(h.tag("prod"))}&limit=100`, { auth: cashier });
  assert.ok(list.json.data.some((p: { id: string }) => p.id === id));
});

test("QA-INV-02 producto: validaciones de precio, nombre y categoría", { skip }, async () => {
  for (const [label, body] of [
    ["precio 0", { price: 0 }], ["precio negativo", { price: -5 }], ["precio enorme", { price: 1e9 }],
    ["precio texto", { price: "abc" }], ["costo negativo", { cost: -1 }], ["nombre corto", { name: "ab" }],
    ["categoría no uuid", { categoryId: "x" }], ["temperatura inválida", { temperature: "TIBIO" }],
  ] as const) {
    const res = await h.req("POST", "/api/products", { auth: admin, body: newProduct(body) });
    assert.equal(res.status, 400, `${label} → ${res.status}`);
  }
  const ghostCat = await h.req("POST", "/api/products", { auth: admin, body: newProduct({ categoryId: "00000000-0000-4000-8000-000000000000" }) });
  assert.ok([400, 404, 409].includes(ghostCat.status), `categoría inexistente → ${ghostCat.status}`);
});

test("QA-INV-03 producto: SKU duplicado (también con otras mayúsculas/espacios) → 409", { skip }, async () => {
  const sku = h.tag("DUP");
  assert.equal((await h.req("POST", "/api/products", { auth: admin, body: newProduct({ sku }) })).status, 201);
  assert.equal((await h.req("POST", "/api/products", { auth: admin, body: newProduct({ sku }) })).status, 409);
  const variant = await h.req("POST", "/api/products", { auth: admin, body: newProduct({ sku: ` ${sku.toLowerCase()} ` }) });
  assert.equal(variant.status, 409, `SKU con otras mayúsculas → ${variant.status}`);
});

test("QA-INV-04 producto: desactivar lo saca del menú; reactivar lo devuelve", { skip }, async () => {
  const p = await h.req("POST", "/api/products", { auth: admin, body: newProduct() });
  const id = p.json.id;
  assert.equal((await h.req("PATCH", `/api/products/${id}/active`, { auth: admin, body: { isActive: false } })).status, 200);
  assert.ok(!(await h.req("GET", "/api/menu", { auth: cashier })).text.includes(id));
  assert.equal((await h.req("PATCH", `/api/products/${id}/active`, { auth: admin, body: { isActive: true } })).status, 200);
  assert.ok((await h.req("GET", "/api/menu", { auth: cashier })).text.includes(id));
});

test("QA-INV-05 producto con ventas: no se borra y su historial queda intacto", { skip }, async () => {
  await openFreshCashSession(h, admin);
  const p = await qaProduct(h, "vendido", 25);
  const order = await h.req("POST", "/api/orders", { auth: cashier, headers: { "X-Idempotency-Key": key() }, body: sale([{ productId: p.id, quantity: 1 }], { cashReceived: 25 }) });
  assert.equal(order.status, 201);
  const del = await h.req("DELETE", `/api/products/${p.id}`, { auth: admin });
  assert.equal(del.status, 409, `borrar producto vendido → ${del.status}`);
  assert.ok(typeof del.json?.message === "string");
  assert.equal(await prisma.product.count({ where: { id: p.id } }), 1);
  assert.equal(await prisma.orderItem.count({ where: { productId: p.id } }), 1);
  const fresh = await h.req("POST", "/api/products", { auth: admin, body: newProduct() });
  assert.equal((await h.req("DELETE", `/api/products/${fresh.json.id}`, { auth: admin })).status, 204, "sin ventas sí se borra");
});

test("QA-INV-06 producto: un CAJERO no crea, edita ni borra", { skip }, async () => {
  const p = await qaProduct(h, "protegido", 10);
  assert.equal((await h.req("POST", "/api/products", { auth: cashier, body: newProduct() })).status, 403);
  assert.equal((await h.req("PATCH", `/api/products/${p.id}`, { auth: cashier, body: { price: 1 } })).status, 403);
  assert.equal((await h.req("DELETE", `/api/products/${p.id}`, { auth: cashier })).status, 403);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).price.toFixed(2), "10.00");
});

test("QA-INV-07 imagen de producto: tipo inválido y archivo vacío se rechazan sin 500", { skip }, async () => {
  const p = await qaProduct(h, "foto", 10);
  const { token, cookie } = await h.csrf();
  const auth = (await h.req("GET", "/api/auth/me", { auth: admin })).status === 200;
  assert.ok(auth);
  const form = new FormData();
  form.append("image", new Blob([Buffer.from("no soy imagen")], { type: "text/plain" }), "x.txt");
  const jwt = (await import("../../src/services/auth.service")).createJwtToken(admin, 0);
  const res = await fetch(`${h.baseUrl}/api/products/${p.id}/image`, { method: "PATCH", headers: { Authorization: `Bearer ${jwt}`, "X-CSRF-TOKEN": token, Cookie: cookie }, body: form });
  assert.ok(res.status >= 400 && res.status < 500, `archivo de texto → ${res.status}`);
  const empty = new FormData();
  const res2 = await fetch(`${h.baseUrl}/api/products/${p.id}/image`, { method: "PATCH", headers: { Authorization: `Bearer ${jwt}`, "X-CSRF-TOKEN": token, Cookie: cookie }, body: empty });
  assert.ok(res2.status >= 400 && res2.status < 500, `sin archivo → ${res2.status}`);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).imageUrl, null);
});

test("QA-INV-08 ingrediente: crear (SKU automático), editar, consultar y desactivar", { skip }, async () => {
  const created = await h.req("POST", "/api/inventory", { auth: admin, body: { name: h.tag("leche"), unitId, minimumStock: 100, maximumStock: 500 } });
  assert.equal(created.status, 201, created.text);
  const ing = created.json.ingredient;
  assert.match(ing.sku, /^INS-\d+/);
  assert.equal(Number(ing.currentStock), 0);
  const patch = await h.req("PATCH", `/api/inventory/${ing.id}`, { auth: admin, body: { name: h.tag("leche-entera"), minimumStock: 200, maximumStock: 800 } });
  assert.equal(patch.status, 200, patch.text);
  const row = await prisma.ingredient.findUniqueOrThrow({ where: { id: ing.id } });
  assert.equal(row.minimumStock.toNumber(), 200);
  assert.equal(row.maximumStock?.toNumber(), 800);
  assert.equal((await h.req("GET", `/api/inventory/${ing.id}`, { auth: cashier })).status, 200);
  assert.equal((await h.req("GET", `/api/inventory/sku/${ing.sku}`, { auth: cashier })).status, 200);
  assert.equal((await h.req("PATCH", `/api/inventory/${ing.id}/active`, { auth: admin, body: { isActive: false } })).status, 200);
  const active = await h.req("GET", `/api/inventory?search=${encodeURIComponent(h.tag("leche"))}`, { auth: admin });
  assert.ok(!active.text.includes(ing.id), "desactivado fuera de la lista por defecto");
});

test("QA-INV-09 ingrediente: datos inválidos → 400 (vacío, negativos, mínimo > máximo, unidad falsa)", { skip }, async () => {
  for (const [label, body] of [
    ["sin nombre", { unitId }],
    ["nombre vacío", { name: "  ", unitId }],
    ["mínimo negativo", { name: h.tag("neg"), unitId, minimumStock: -1 }],
    ["mínimo texto", { name: h.tag("txt"), unitId, minimumStock: "mucho" }],
    ["mínimo > máximo", { name: h.tag("minmax"), unitId, minimumStock: 10, maximumStock: 5 }],
    ["unidad no uuid", { name: h.tag("unidad"), unitId: "kg" }],
  ] as const) {
    const res = await h.req("POST", "/api/inventory", { auth: admin, body });
    assert.equal(res.status, 400, `${label} → ${res.status} ${res.text.slice(0, 100)}`);
  }
  const ghostUnit = await h.req("POST", "/api/inventory", { auth: admin, body: { name: h.tag("ghost"), unitId: "00000000-0000-4000-8000-000000000000" } });
  assert.ok([400, 404].includes(ghostUnit.status), `unidad inexistente → ${ghostUnit.status}`);
  const ing = await qaIngredient(h, "edit-minmax", 0, 1, 0);
  const upd = await h.req("PATCH", `/api/inventory/${ing.id}`, { auth: admin, body: { minimumStock: 50, maximumStock: 10 } });
  assert.equal(upd.status, 400, `editar mínimo > máximo → ${upd.status}`);
});

test("QA-INV-10 números con espacios ('5 ', ' 5') en cantidades: se aceptan o rechazan, nunca 500", { skip }, async () => {
  const ing = await qaIngredient(h, "espacios", 100);
  const results: string[] = [];
  const create = await h.req("POST", "/api/inventory", { auth: admin, body: { name: h.tag("esp-min"), unitId, minimumStock: " 5" } });
  results.push(`crear minimumStock=" 5" → ${create.status}`);
  const exit = await h.req("POST", "/api/inventory/exits", { auth: admin, headers: { "X-Idempotency-Key": key() }, body: { ingredientId: ing.id, quantity: "5 ", reason: "waste" } });
  results.push(`salida quantity="5 " → ${exit.status}`);
  const purchase = await h.req("POST", "/api/purchases", { auth: admin, headers: { "X-Idempotency-Key": key() }, body: { items: [{ ingredientId: ing.id, quantity: " 2", unitCost: "10" }] } });
  results.push(`compra quantity=" 2" → ${purchase.status}`);
  const emptyCost = await h.req("POST", "/api/purchases", { auth: admin, headers: { "X-Idempotency-Key": key() }, body: { items: [{ ingredientId: ing.id, quantity: "2", unitCost: "" }] } });
  results.push(`compra unitCost="" → ${emptyCost.status}`);
  const fiveHundreds = results.filter((r) => / 5\d\d$/.test(r));
  assert.deepEqual(fiveHundreds, [], results.join(" | "));
});

test("QA-INV-11 ingrediente usado en receta, compra o movimiento no se borra; uno limpio sí", { skip }, async () => {
  const used = await qaIngredient(h, "en-receta", 10);
  await qaProduct(h, "con-receta", 30, { recipe: { [used.id]: 2 } });
  const blocked = await h.req("DELETE", `/api/inventory/${used.id}`, { auth: admin });
  assert.equal(blocked.status, 409, blocked.text);
  assert.equal(await prisma.ingredient.count({ where: { id: used.id } }), 1);
  const clean = await h.req("POST", "/api/inventory", { auth: admin, body: { name: h.tag("limpio"), unitId } });
  assert.equal((await h.req("DELETE", `/api/inventory/${clean.json.ingredient.id}`, { auth: admin })).status, 200);
});

test("QA-INV-12 nombre de ingrediente duplicado (mayúsculas/espacios) → 409", { skip }, async () => {
  const name = h.tag("Cafe Molido");
  assert.equal((await h.req("POST", "/api/inventory", { auth: admin, body: { name, unitId } })).status, 201);
  const dup = await h.req("POST", "/api/inventory", { auth: admin, body: { name: `  ${name.toUpperCase()} `, unitId } });
  assert.equal(dup.status, 409, `duplicado → ${dup.status}`);
});

test("QA-INV-13 salida manual: descuenta, registra movimiento con saldo y es idempotente", { skip }, async () => {
  const ing = await qaIngredient(h, "merma", 50);
  const idem = key();
  const body = { ingredientId: ing.id, quantity: 7.5, reason: "waste", notes: "qa" };
  const a = await h.req("POST", "/api/inventory/exits", { auth: admin, headers: { "X-Idempotency-Key": idem }, body });
  const b = await h.req("POST", "/api/inventory/exits", { auth: admin, headers: { "X-Idempotency-Key": idem }, body });
  assert.equal(a.status, 201, a.text);
  assert.ok([200, 201].includes(b.status));
  const row = await prisma.ingredient.findUniqueOrThrow({ where: { id: ing.id } });
  assert.equal(row.currentStock.toNumber(), 42.5, "descontado una vez");
  const movs = await prisma.inventoryMovement.findMany({ where: { ingredientId: ing.id } });
  assert.equal(movs.length, 1);
  assert.equal(movs[0].balanceAfter?.toNumber(), 42.5);
  for (const bad of [{ quantity: 0 }, { quantity: -3 }, { quantity: "x" }, { reason: "robo" }]) {
    const res = await h.req("POST", "/api/inventory/exits", { auth: admin, headers: { "X-Idempotency-Key": key() }, body: { ...body, ...bad } });
    assert.equal(res.status, 400, `${JSON.stringify(bad)} → ${res.status}`);
  }
  const noKey = await h.req("POST", "/api/inventory/exits", { auth: admin, body });
  assert.equal(noKey.status, 400);
});

test("QA-INV-14 salida mayor a la existencia: comportamiento documentado (stock negativo permitido)", { skip }, async () => {
  const ing = await qaIngredient(h, "sobre-salida", 3);
  const res = await h.req("POST", "/api/inventory/exits", { auth: admin, headers: { "X-Idempotency-Key": key() }, body: { ingredientId: ing.id, quantity: 10, reason: "damaged" } });
  const stock = (await prisma.ingredient.findUniqueOrThrow({ where: { id: ing.id } })).currentStock.toNumber();
  // D-1 / plan-inventario-tiempo-real: stock may go negative; a real loss must be recordable.
  assert.ok((res.status === 201 && stock === -7) || (res.status >= 400 && res.status < 500 && stock === 3), `${res.status}, stock=${stock}`);
});

test("QA-INV-15 unidades: catálogo con dimensión y factor > 0 coherentes (kg/lt = 1000 × base)", { skip }, async () => {
  const res = await h.req("GET", "/api/inventory/units", { auth: cashier });
  assert.equal(res.status, 200);
  const units = (Array.isArray(res.json) ? res.json : res.json.data) as { abbreviation: string; factor: string; dimension: string }[];
  assert.ok(units.length >= 5);
  for (const u of units) assert.ok(Number(u.factor) > 0, `${u.abbreviation} factor ${u.factor}`);
  const kg = units.find((u) => u.abbreviation.toLowerCase() === "kg");
  if (kg) assert.equal(Number(kg.factor), 1000);
});

test("QA-INV-16 la unidad de un ingrediente no se cambia por API (campo ignorado o rechazado)", { skip }, async () => {
  const ing = await qaIngredient(h, "unidad-fija", 10);
  const other = await prisma.inventoryUnit.findFirstOrThrow({ where: { id: { not: ing.unitId } } });
  await h.req("PATCH", `/api/inventory/${ing.id}`, { auth: admin, body: { unitId: other.id } });
  const row = await prisma.ingredient.findUniqueOrThrow({ where: { id: ing.id } });
  assert.equal(row.unitId, ing.unitId, "la unidad cambió sin convertir la existencia");
  assert.equal(row.currentStock.toNumber(), 10);
});

test("QA-INV-17 el stock y el costo no se editan directamente por PATCH", { skip }, async () => {
  const ing = await qaIngredient(h, "stock-fijo", 10, 2);
  await h.req("PATCH", `/api/inventory/${ing.id}`, { auth: admin, body: { currentStock: 9999, averageCost: 0.01 } });
  const row = await prisma.ingredient.findUniqueOrThrow({ where: { id: ing.id } });
  assert.equal(row.currentStock.toNumber(), 10);
  assert.equal(row.averageCost.toNumber(), 2);
});

test("QA-INV-18 movimientos: listado filtrable por ingrediente y paginado", { skip }, async () => {
  const ing = await qaIngredient(h, "movs", 20);
  for (let i = 0; i < 3; i++) {
    await h.req("POST", "/api/inventory/exits", { auth: admin, headers: { "X-Idempotency-Key": key() }, body: { ingredientId: ing.id, quantity: 1, reason: "sample" } });
  }
  const res = await h.req("GET", `/api/inventory/movements?ingredientId=${ing.id}&limit=2`, { auth: admin });
  assert.equal(res.status, 200, res.text);
  const rows = res.json.data ?? res.json.movements;
  assert.equal(rows.length, 2);
  assert.equal((await h.req("GET", "/api/inventory/movements?startDate=ayer", { auth: admin })).status, 400);
});
