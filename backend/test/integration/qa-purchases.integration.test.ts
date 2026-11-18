import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { QaHarness, integrationEnabled, key, type QaUser } from "./qa-http";
// The real frontend functions that build what "Nueva compra" sends (pure, no React).
import { buildPurchaseLine, toPurchaseItemPayload } from "../../../frontend/src/features/inventory/utils/purchaseLine";

// QA audit 2026-11-18 — Creación de compras con los datos que realmente envía la pantalla
// (InventoryAddEntry.tsx → buildPurchaseLine → toPurchaseItemPayload → POST /api/purchases).

const h = new QaHarness();
const skip = !integrationEnabled;
let admin: QaUser;
const units: Record<string, string> = {};

async function ingredient(name: string, unitAbbr: string) {
  return prisma.ingredient.create({ data: { name: h.tag(name), unitId: units[unitAbbr], currentStock: 0 } });
}

/** One line typed in the form: quantity in `captureUnit`, TOTAL cost of the line. */
function line(ing: { id: string; name: string }, baseUnit: string, captureUnit: string, quantity: number, totalCost: number) {
  return buildPurchaseLine({ ingredientId: ing.id, ingredientName: ing.name, baseUnit, captureUnit, quantity, totalCost });
}

async function submit(lines: ReturnType<typeof line>[], extra: Record<string, unknown> = {}) {
  return h.req("POST", "/api/purchases", { auth: admin, headers: { "X-Idempotency-Key": key() }, body: { ...extra, items: lines.map(toPurchaseItemPayload) } });
}

before(async () => {
  if (skip) return;
  await h.start();
  admin = await h.user("admin", "ADMIN");
  for (const u of await prisma.inventoryUnit.findMany()) units[u.abbreviation] = u.id;
});

after(async () => {
  if (skip) return;
  await h.stop();
});

test("QA-COM-00 unidades del seed que usa la pantalla (gr, kg, ml, lt, pz)", { skip }, () => {
  for (const abbr of ["gr", "kg", "ml", "lt"]) assert.ok(units[abbr], `falta la unidad ${abbr}: ${Object.keys(units).join(",")}`);
});

test("QA-COM-01 compra típica capturada en la unidad base", { skip }, async () => {
  const leche = await ingredient("leche", "ml");
  const res = await submit([line(leche, "ml", "ml", 4000, 96)]);
  assert.equal(res.status, 201, res.text);
  const item = await prisma.purchaseItem.findFirstOrThrow({ where: { purchaseId: res.json.purchase.id } });
  assert.equal(item.quantity.toNumber(), 4000);
  assert.equal(Number(res.json.purchase.total), 96);
});

test("QA-COM-02 capturada en kg/lt (convertida a gr/ml) con costos que no dan exacto", { skip }, async () => {
  const azucar = await ingredient("azucar", "gr");
  const leche = await ingredient("leche-lt", "ml");
  // 3 kg por $100 → 3000 gr a $0.0333…/gr; 1.1 lt por $27.50 → 1100.0000000000002 ml (float).
  const lines = [line(azucar, "gr", "kg", 3, 100), line(leche, "ml", "lt", 1.1, 27.5)];
  const res = await submit(lines);
  assert.equal(res.status, 201, res.text);
  const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: res.json.purchase.id }, include: { items: true } });
  assert.equal(purchase.total.toFixed(2), "127.50", `total guardado ${purchase.total} (lo que se pagó: 127.50)`);
  const sumItems = purchase.items.reduce((s, i) => s + Number(i.total), 0);
  assert.equal(sumItems.toFixed(2), "127.50", "suma de renglones = total");
  for (const i of purchase.items) {
    assert.equal((i.quantity.toNumber() * i.unitCost.toNumber()).toFixed(2), Number(i.total).toFixed(2),
      `renglón: cantidad × costo unitario guardados (${i.quantity} × ${i.unitCost}) ≠ total ${i.total}`);
  }
});

test("QA-COM-03 compras grandes normales: 200 kg de azúcar, 150 lt de leche", { skip }, async () => {
  const azucar = await ingredient("azucar-bulto", "gr");
  const leche = await ingredient("leche-granel", "ml");
  for (const [ing, base, capture, qty, cost] of [[azucar, "gr", "kg", 200, 5600], [leche, "ml", "lt", 150, 3600]] as const) {
    const res = await submit([line(ing, base, capture, qty, cost)]);
    assert.equal(res.status, 201, `${qty} ${capture} → ${res.status} ${res.text}`);
  }
});

test("QA-COM-04 insumo barato por gramo: el costo unitario conserva la precisión", { skip }, async () => {
  const hielo = await ingredient("hielo", "gr");
  // 10 kg de hielo por $35 → $0.0035/gr exacto; 3 kg de sal por $25 → $0.008333…/gr.
  const sal = await ingredient("sal", "gr");
  const res = await submit([line(hielo, "gr", "kg", 10, 35), line(sal, "gr", "kg", 3, 25)]);
  assert.equal(res.status, 201, res.text);
  const items = await prisma.purchaseItem.findMany({ where: { purchaseId: res.json.purchase.id } });
  const salItem = items.find((i) => i.ingredientId === sal.id)!;
  const valueStored = salItem.quantity.toNumber() * salItem.unitCost.toNumber();
  assert.ok(Math.abs(valueStored - 25) < 0.01, `valor de la sal al costo guardado: ${valueStored.toFixed(4)} (se pagó 25.00; costo/gr guardado ${salItem.unitCost})`);
});

test("QA-COM-05 mismo ingrediente en dos renglones y proveedor seleccionado", { skip }, async () => {
  const cafe = await ingredient("cafe", "gr");
  const supplier = await prisma.supplier.create({ data: { name: h.tag("tostador") } });
  const res = await submit([line(cafe, "gr", "kg", 1, 350), line(cafe, "gr", "gr", 500, 180)], { supplierId: supplier.id, notes: "Factura 123 — entrega martes" });
  assert.equal(res.status, 201, res.text);
  assert.equal(res.json.purchase.supplierId, supplier.id);
});

test("QA-COM-06 borrador restaurado con un ingrediente que ya no está activo: mensaje claro, no genérico", { skip }, async () => {
  const viejo = await ingredient("desactivado", "gr");
  await prisma.ingredient.update({ where: { id: viejo.id }, data: { isActive: false } });
  const res = await submit([line(viejo, "gr", "gr", 100, 10)]);
  assert.ok(res.status >= 400 && res.status < 500);
  assert.notEqual(res.json.message, "Error de validación.", "el usuario ve un mensaje sin el motivo");
});

test("QA-COM-07 cada error de validación de una compra le dice al usuario el motivo (message)", { skip }, async () => {
  const ing = await ingredient("motivo", "gr");
  const cases: [string, Record<string, unknown>][] = [
    ["cantidad fuera de rango", { items: [{ ingredientId: ing.id, quantity: 10_000_001, unitCost: 1 }] }],
    ["notas de 1001 caracteres", { notes: "x".repeat(1001), items: [{ ingredientId: ing.id, quantity: 1, unitCost: 1 }] }],
    ["sin renglones", { items: [] }],
  ];
  const generic: string[] = [];
  for (const [label, body] of cases) {
    const res = await h.req("POST", "/api/purchases", { auth: admin, headers: { "X-Idempotency-Key": key() }, body });
    assert.equal(res.status, 400, `${label} → ${res.status}`);
    if (res.json.message === "Error de validación.") generic.push(`${label}: message genérico; motivo solo en errors=${JSON.stringify(res.json.errors)}`);
  }
  assert.deepEqual(generic, [], "el toast de la pantalla solo muestra `message`");
});

test("QA-COM-08 el número de factura usa la fecha del negocio (America/Mexico_City)", { skip }, async () => {
  const ing = await ingredient("folio", "gr");
  const res = await submit([line(ing, "gr", "gr", 1, 1)]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date()).split("-").join("/");
  assert.match(res.json.purchase.invoiceNumber, new RegExp(`^FAC-${today}-\\d{5}$`), `folio ${res.json.purchase.invoiceNumber}, día del negocio ${today}`);
});

test("QA-COM-09 recibir la compra convertida: existencias y costo promedio correctos", { skip }, async () => {
  const azucar = await ingredient("azucar-recibir", "gr");
  const res = await submit([line(azucar, "gr", "kg", 2, 56)]);
  assert.equal(res.status, 201, res.text);
  const rec = await h.req("POST", `/api/purchases/${res.json.purchase.id}/receive`, { auth: admin, body: {} });
  assert.equal(rec.status, 200, rec.text);
  const row = await prisma.ingredient.findUniqueOrThrow({ where: { id: azucar.id } });
  assert.equal(row.currentStock.toNumber(), 2000);
  assert.equal(row.averageCost.toNumber(), 0.028);
});
