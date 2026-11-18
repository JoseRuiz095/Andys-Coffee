import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { QaHarness, integrationEnabled, openFreshCashSession, closeAnyCashSession, qaProduct, sale, key, type QaUser } from "./qa-http";

// QA audit 2026-11-18 — Ventas (POS). IDs QA-VEN-xx, referenced from
// docs/Project/AUDIT/auditoria-qa-integral-2026-11-18.md.

const h = new QaHarness();
const skip = !integrationEnabled;
let admin: QaUser;
let cashier: QaUser;
let latte: { id: string };     // 45.00, HOT/COLD, jumbo 55.00
let cookie: { id: string };    // 18.50
let inactive: { id: string };
let sessionId: string;
let lastCreatedTotal = "";

const post = (path: string, body: unknown, auth: QaUser = cashier, idem: string | null = key()) =>
  h.req("POST", path, { auth, body, headers: idem ? { "X-Idempotency-Key": idem } : {} });

async function expected() {
  return Number((await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionId } })).expectedAmount);
}

before(async () => {
  if (skip) return;
  await h.start();
  admin = await h.user("admin", "ADMIN");
  cashier = await h.user("cajero", "CAJERO");
  latte = await qaProduct(h, "latte", 45, { temperature: "BOTH", jumboPrice: 55 });
  cookie = await qaProduct(h, "galleta", 18.5);
  inactive = await qaProduct(h, "inactivo", 30);
  await prisma.product.update({ where: { id: inactive.id }, data: { isActive: false } });
  sessionId = (await openFreshCashSession(h, admin, 500)).id;
});

after(async () => {
  if (skip) return;
  await closeAnyCashSession();
  await h.stop();
});

test("QA-VEN-01 el menú del POS lista productos activos y oculta los inactivos", { skip }, async () => {
  const res = await h.req("GET", "/api/menu", { auth: cashier });
  assert.equal(res.status, 200);
  const text = JSON.stringify(res.json);
  assert.ok(text.includes(h.tag("galleta")), "producto activo visible");
  assert.ok(!text.includes(h.tag("inactivo")), "producto inactivo oculto");
});

test("QA-VEN-02 la cotización (lo que ve el POS) coincide con lo cobrado y guardado", { skip }, async () => {
  const items = [
    { productId: latte.id, quantity: 2, temperature: "COLD" },
    { productId: latte.id, quantity: 1, temperature: "HOT", size: "JUMBO" },
    { productId: cookie.id, quantity: 3 },
  ];
  const quote = await h.req("POST", "/api/orders/quote", { auth: cashier, body: { items } });
  assert.equal(quote.status, 200, quote.text);
  // 2×45 + 55 + 3×18.50 = 200.50
  assert.equal(quote.json.total, "200.50");
  const created = await post("/api/orders", sale(items, { cashReceived: 250 }));
  assert.equal(created.status, 201, created.text);
  assert.equal(Number(created.json.total), Number(quote.json.total));
  lastCreatedTotal = String(created.json.total);
  const row = await prisma.order.findUniqueOrThrow({ where: { id: created.json.id }, include: { items: true, payments: true } });
  assert.equal(row.total.toFixed(2), "200.50");
  assert.equal(row.subtotal.toFixed(2), "200.50");
  const sumLines = row.items.reduce((s, i) => s + Number(i.subtotal), 0);
  assert.equal(sumLines.toFixed(2), "200.50", "suma de líneas = total");
  assert.equal(row.payments.length, 1);
  assert.equal(row.payments[0].amount.toFixed(2), "200.50");
  const jumbo = row.items.find((i) => i.size === "JUMBO");
  assert.equal(jumbo?.unitPrice.toFixed(2), "55.00", "precio Jumbo");
  const mov = await prisma.cashMovement.findFirstOrThrow({ where: { referenceId: row.id, type: "sale" } });
  assert.equal(mov.amount.toFixed(2), "200.50");
  assert.equal(mov.receivedAmount?.toFixed(2), "250.00");
  assert.equal(mov.changeAmount?.toFixed(2), "49.50", "cambio = recibido − total");
});

test("QA-VEN-02b el dinero se serializa igual en la cotización y en la venta (2 decimales)", { skip }, async () => {
  // quote() documents "Money is returned as fixed two-decimal strings, like every Decimal in the API".
  assert.equal(lastCreatedTotal, "200.50", `POST /orders devolvió total=${lastCreatedTotal}`);
});

test("QA-VEN-03 rechaza cantidades inválidas (0, negativa, decimal, >99, texto)", { skip }, async () => {
  for (const quantity of [0, -1, 1.5, 100, "2"]) {
    const res = await post("/api/orders", sale([{ productId: cookie.id, quantity }], { cashReceived: 1000 }));
    assert.equal(res.status, 400, `quantity=${JSON.stringify(quantity)} → ${res.status}`);
  }
});

test("QA-VEN-04 el cliente no puede imponer precio, descuento ni total", { skip }, async () => {
  for (const tamper of [{ unitPrice: 1 }, { discount: 18 }, { subtotal: 0 }]) {
    const res = await post("/api/orders", sale([{ productId: cookie.id, quantity: 1, ...tamper }], { cashReceived: 100 }));
    assert.equal(res.status, 400, `campo ${Object.keys(tamper)[0]} aceptado`);
  }
  const res = await post("/api/orders", { ...sale([{ productId: cookie.id, quantity: 1 }], { cashReceived: 100 }), total: 1 });
  assert.equal(res.status, 400, "total en el body aceptado");
});

test("QA-VEN-05 temperatura y tamaño inválidos para el producto se rechazan sin crear nada", { skip }, async () => {
  const idem = key();
  const jumboNoPrice = await post("/api/orders", sale([{ productId: cookie.id, quantity: 1, size: "JUMBO" }], { cashReceived: 100 }), cashier, idem);
  assert.ok([400, 409].includes(jumboNoPrice.status), `Jumbo sin precio Jumbo → ${jumboNoPrice.status}`);
  const cold = await post("/api/orders", sale([{ productId: cookie.id, quantity: 1, temperature: "COLD" }], { cashReceived: 100 }));
  assert.ok([400, 409].includes(cold.status), `temperatura en producto sin temperatura → ${cold.status}`);
  assert.equal(await prisma.order.count({ where: { idempotencyKey: idem } }), 0);
});

test("QA-VEN-06 efectivo insuficiente: 409 y sin orden, pago ni movimiento parcial", { skip }, async () => {
  const before = await expected();
  const idem = key();
  const res = await post("/api/orders", sale([{ productId: latte.id, quantity: 1, temperature: "HOT" }], { cashReceived: 10 }), cashier, idem);
  assert.equal(res.status, 409, res.text);
  assert.equal(await prisma.order.count({ where: { idempotencyKey: idem } }), 0);
  assert.equal(await expected(), before, "la caja no cambió");
});

test("QA-VEN-07 transferencia y tarjeta: pago registrado sin movimiento de efectivo", { skip }, async () => {
  for (const method of ["transfer", "card", "Transferencia", "Tarjeta"]) {
    const before = await expected();
    const res = await post("/api/orders", { items: [{ productId: cookie.id, quantity: 2 }], paymentMethod: method });
    assert.equal(res.status, 201, `${method}: ${res.text}`);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: res.json.id } });
    assert.equal(payment.status, "paid");
    assert.equal(payment.amount.toFixed(2), "37.00");
    assert.equal(await prisma.cashMovement.count({ where: { referenceId: res.json.id } }), 0);
    assert.equal(await expected(), before);
  }
});

test("QA-VEN-08 método de pago desconocido o sin efectivo recibido en venta en efectivo", { skip }, async () => {
  const bad = await post("/api/orders", { items: [{ productId: cookie.id, quantity: 1 }], paymentMethod: "bitcoin" });
  assert.equal(bad.status, 400);
  const noReceived = await post("/api/orders", { items: [{ productId: cookie.id, quantity: 1 }], paymentMethod: "cash" });
  assert.equal(noReceived.status, 409, `venta en efectivo sin monto recibido → ${noReceived.status}`);
  const negative = await post("/api/orders", sale([{ productId: cookie.id, quantity: 1 }], { cashReceived: -5 }));
  assert.equal(negative.status, 400);
});

test("QA-VEN-09 pago pendiente: requiere cliente; se liquida una sola vez y entra a caja", { skip }, async () => {
  const noName = await post("/api/orders", { items: [{ productId: cookie.id, quantity: 1 }], paymentMethod: "pending" });
  assert.equal(noName.status, 400);
  const res = await post("/api/orders", { items: [{ productId: cookie.id, quantity: 1 }], paymentMethod: "pending", customerName: h.tag("fiado") });
  assert.equal(res.status, 201, res.text);
  const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: res.json.id } });
  assert.equal(payment.status, "pending");
  const before = await expected();
  const [a, b] = await Promise.all([
    h.req("PATCH", `/api/orders/payments/${payment.id}/settle`, { auth: cashier, body: { method: "cash", cashReceived: 20 } }),
    h.req("PATCH", `/api/orders/payments/${payment.id}/settle`, { auth: cashier, body: { method: "cash", cashReceived: 20 } }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409], `liquidaciones concurrentes: ${a.status}/${b.status}`);
  assert.equal(await expected(), before + 18.5, "entra a caja una sola vez");
  const again = await h.req("PATCH", `/api/orders/payments/${payment.id}/settle`, { auth: cashier, body: { method: "card" } });
  assert.equal(again.status, 409);
});

test("QA-VEN-10 idempotencia secuencial: la misma clave devuelve la misma venta; otro carrito → 409", { skip }, async () => {
  const idem = key();
  const body = sale([{ productId: cookie.id, quantity: 1 }], { cashReceived: 20 });
  const first = await post("/api/orders", body, cashier, idem);
  const second = await post("/api/orders", body, cashier, idem);
  assert.equal(first.status, 201);
  assert.ok([200, 201].includes(second.status));
  assert.equal(second.json.id, first.json.id);
  assert.equal(await prisma.order.count({ where: { idempotencyKey: idem } }), 1);
  assert.equal(await prisma.cashMovement.count({ where: { referenceId: first.json.id, type: "sale" } }), 1);
  const other = await post("/api/orders", sale([{ productId: cookie.id, quantity: 5 }], { cashReceived: 200 }), cashier, idem);
  assert.equal(other.status, 409);
});

test("QA-VEN-11 idempotencia concurrente: 8 envíos simultáneos con la misma clave → 1 venta", { skip }, async () => {
  const idem = key();
  const before = await expected();
  const body = sale([{ productId: cookie.id, quantity: 2 }], { cashReceived: 50 });
  const results = await Promise.all(Array.from({ length: 8 }, () => post("/api/orders", body, cashier, idem)));
  const statuses = results.map((r) => r.status);
  assert.equal(await prisma.order.count({ where: { idempotencyKey: idem } }), 1, "una sola orden");
  assert.equal(await expected(), before + 37, "un solo cobro en caja");
  assert.ok(statuses.every((s) => s === 200 || s === 201), `todos los reintentos responden la venta: ${statuses.join(",")}`);
  assert.equal(new Set(results.map((r) => r.json?.id)).size, 1);
});

test("QA-VEN-12 ventas distintas concurrentes: ninguna se pierde y la caja suma exacto", { skip }, async () => {
  const before = await expected();
  const results = await Promise.all(Array.from({ length: 8 }, () =>
    post("/api/orders", sale([{ productId: cookie.id, quantity: 1 }], { cashReceived: 20 }))));
  const statuses = results.map((r) => r.status);
  const created = results.filter((r) => r.status === 201).length;
  assert.equal(await expected(), before + 18.5 * created, "expectedAmount = suma de ventas creadas");
  assert.equal(created, 8, `ventas creadas ${created}/8 (estados: ${statuses.join(",")})`);
  const numbers = results.map((r) => r.json?.orderNumber);
  assert.equal(new Set(numbers).size, 8, "folios únicos");
});

test("QA-VEN-12b dos o tres cajas cobrando a la vez (caso real): ninguna venta se rechaza", { skip }, async () => {
  const outcome: string[] = [];
  let rejected = 0;
  for (const parallel of [2, 2, 2, 3, 3, 3]) {
    const results = await Promise.all(Array.from({ length: parallel }, () =>
      post("/api/orders", sale([{ productId: cookie.id, quantity: 1 }], { cashReceived: 20 }))));
    const statuses = results.map((r) => r.status);
    rejected += statuses.filter((s) => s !== 201).length;
    outcome.push(statuses.join("/"));
  }
  assert.equal(rejected, 0, `ventas rechazadas por concurrencia: ${rejected} — rondas ${outcome.join(" | ")}`);
});

test("QA-VEN-13 sin caja abierta la venta se rechaza y no deja rastro", { skip }, async () => {
  await prisma.cashSession.update({ where: { id: sessionId }, data: { status: "closed" } });
  try {
    const idem = key();
    const res = await post("/api/orders", sale([{ productId: cookie.id, quantity: 1 }], { cashReceived: 20 }), cashier, idem);
    assert.equal(res.status, 409, res.text);
    assert.equal(await prisma.order.count({ where: { idempotencyKey: idem } }), 0);
  } finally {
    await prisma.cashSession.update({ where: { id: sessionId }, data: { status: "open" } });
  }
});

test("QA-VEN-14 producto inactivo o inexistente no se puede vender", { skip }, async () => {
  const off = await post("/api/orders", sale([{ productId: inactive.id, quantity: 1 }], { cashReceived: 100 }));
  assert.ok([400, 409].includes(off.status), `inactivo → ${off.status}`);
  const ghost = await post("/api/orders", sale([{ productId: "00000000-0000-4000-8000-000000000000", quantity: 1 }], { cashReceived: 100 }));
  assert.ok([400, 404, 409].includes(ghost.status), `inexistente → ${ghost.status}`);
  const noKey = await post("/api/orders", sale([{ productId: cookie.id, quantity: 1 }], { cashReceived: 100 }), cashier, null);
  assert.equal(noKey.status, 400, "sin X-Idempotency-Key");
});

test("QA-VEN-15 el historial conserva importes y nombre aunque cambie el producto", { skip }, async () => {
  const p = await qaProduct(h, "historico", 40);
  const res = await post("/api/orders", sale([{ productId: p.id, quantity: 2 }], { cashReceived: 100 }));
  assert.equal(res.status, 201);
  const patch = await h.req("PATCH", `/api/products/${p.id}`, { auth: admin, body: { price: 99, name: h.tag("renombrado") } });
  assert.equal(patch.status, 200, patch.text);
  const detail = await h.req("GET", `/api/orders/${res.json.id}`, { auth: cashier });
  assert.equal(detail.status, 200);
  assert.equal(Number(detail.json.total), 80);
  assert.equal(Number(detail.json.items[0].unitPrice), 40);
  assert.equal(detail.json.items[0].productName, h.tag("historico"));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
  const byDate = await h.req("GET", `/api/orders/by-date?date=${today}`, { auth: cashier });
  assert.equal(byDate.status, 200);
  assert.ok(JSON.stringify(byDate.json).includes(res.json.id), "aparece en el historial del día");
});

test("QA-VEN-16 cancelar una venta pendiente en efectivo devuelve el dinero una sola vez (concurrente)", { skip }, async () => {
  const res = await post("/api/orders", sale([{ productId: latte.id, quantity: 1, temperature: "HOT" }], { cashReceived: 50 }));
  assert.equal(res.status, 201);
  const before = await expected();
  // CAJERO has no sales.cancel by design (seed.ts): cancelling is an ADMIN action.
  const denied = await h.req("PATCH", `/api/orders/${res.json.id}/status`, { auth: cashier, body: { status: "cancelled" } });
  assert.equal(denied.status, 403);
  const [a, b] = await Promise.all([
    h.req("PATCH", `/api/orders/${res.json.id}/status`, { auth: admin, body: { status: "cancelled", reason: "qa" } }),
    h.req("PATCH", `/api/orders/${res.json.id}/status`, { auth: admin, body: { status: "cancelled", reason: "qa" } }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409], `${a.status}/${b.status}`);
  assert.equal(await expected(), before - 45);
  assert.equal(await prisma.cashMovement.count({ where: { referenceId: res.json.id, type: "sale_reversal" } }), 1);
  const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: res.json.id } });
  assert.notEqual(payment.status, "paid", "el pago queda cancelado");
});

test("QA-VEN-17 una venta completada solo se cancela con solicitud aprobada por admin", { skip }, async () => {
  const res = await post("/api/orders", sale([{ productId: cookie.id, quantity: 1 }], { cashReceived: 20 }));
  const id = res.json.id;
  for (const status of ["preparing", "ready", "completed"]) {
    const r = await h.req("PATCH", `/api/orders/${id}/status`, { auth: cashier, body: { status } });
    assert.equal(r.status, 200, `${status}: ${r.text}`);
  }
  const direct = await h.req("PATCH", `/api/orders/${id}/status`, { auth: admin, body: { status: "cancelled" } });
  assert.equal(direct.status, 409, "completada no se cancela directo");
  const request = await h.req("POST", `/api/orders/${id}/cancellation-requests`, { auth: cashier, body: { reason: "cliente se arrepintió" } });
  assert.equal(request.status, 201, request.text);
  const cashierApprove = await h.req("PATCH", `/api/orders/cancellation-requests/${request.json.id}/approve`, { auth: cashier, body: {} });
  assert.equal(cashierApprove.status, 403, "el cajero no aprueba");
  const before = await expected();
  const [x, y] = await Promise.all([
    h.req("PATCH", `/api/orders/cancellation-requests/${request.json.id}/approve`, { auth: admin, body: {} }),
    h.req("PATCH", `/api/orders/cancellation-requests/${request.json.id}/approve`, { auth: admin, body: {} }),
  ]);
  assert.deepEqual([x.status, y.status].sort(), [200, 409], `${x.status}/${y.status}`);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id } })).status, "cancelled");
  assert.equal(await expected(), before - 18.5, "reversa una vez");
});

test("QA-VEN-18 mandadito absorbido: no suma al total y genera gasto + salida de caja", { skip }, async () => {
  const before = await expected();
  const res = await post("/api/orders", sale([{ productId: cookie.id, quantity: 1 }], {
    cashReceived: 20, hasDelivery: true, deliveryAmount: 15, deliveryResponsible: "business_absorbs",
  }));
  assert.equal(res.status, 201, res.text);
  assert.equal(Number(res.json.total), 18.5, "el mandadito no es ingreso");
  const expense = await prisma.expense.findFirst({ where: { sourceOrderId: res.json.id } });
  assert.equal(expense?.amount.toFixed(2), "15.00");
  assert.equal(await expected(), before + 18.5 - 15);
});

test("QA-VEN-19 impuestos: el sistema no calcula IVA (tax = 0) — se documenta", { skip }, async () => {
  const res = await post("/api/orders", sale([{ productId: cookie.id, quantity: 1 }], { cashReceived: 20 }));
  const row = await prisma.order.findUniqueOrThrow({ where: { id: res.json.id } });
  assert.equal(row.tax.toFixed(2), "0.00");
  assert.equal(row.total.toFixed(2), row.subtotal.sub(row.discount).toFixed(2), "total = subtotal − descuento");
});

test("QA-VEN-20 límites del carrito: 100 líneas se aceptan, 101 no; carrito vacío no", { skip }, async () => {
  const many = Array.from({ length: 101 }, () => ({ productId: cookie.id, quantity: 1 }));
  assert.equal((await h.req("POST", "/api/orders/quote", { auth: cashier, body: { items: many } })).status, 400);
  assert.equal((await h.req("POST", "/api/orders/quote", { auth: cashier, body: { items: many.slice(0, 100) } })).status, 200);
  assert.equal((await h.req("POST", "/api/orders/quote", { auth: cashier, body: { items: [] } })).status, 400);
});

test("QA-VEN-21 venta programada en el pasado se rechaza; futura queda pendiente", { skip }, async () => {
  const past = await post("/api/orders", sale([{ productId: cookie.id, quantity: 1 }], { cashReceived: 20, scheduledFor: new Date(Date.now() - 60_000).toISOString() }));
  assert.equal(past.status, 400);
  const future = await post("/api/orders", sale([{ productId: cookie.id, quantity: 1 }], { cashReceived: 20, scheduledFor: new Date(Date.now() + 3 * 3600_000).toISOString() }));
  assert.equal(future.status, 201, future.text);
  const early = await h.req("PATCH", `/api/orders/${future.json.id}/status`, { auth: cashier, body: { status: "preparing" } });
  assert.equal(early.status, 409, "no se prepara antes de la ventana de 20 min");
});
