import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { QaHarness, integrationEnabled, openFreshCashSession, closeAnyCashSession, qaProduct, sale, key, type QaUser } from "./qa-http";

// QA audit 2026-11-18 — Órdenes (tablero pendiente → en preparación → lista → completada).

const h = new QaHarness();
const skip = !integrationEnabled;
let admin: QaUser;
let cashier: QaUser;
let noPerms: QaUser;
let cancelOnly: QaUser;
let product: { id: string };

const STATUSES = ["pending", "preparing", "ready", "completed", "cancelled"] as const;
type Status = (typeof STATUSES)[number];
const PATH: Status[] = ["pending", "preparing", "ready", "completed"];
// Rules read from OrderService.updateStatus (validTransitions).
const ALLOWED: Record<Status, Status[]> = {
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

async function newOrder(user: QaUser = cashier, customerName?: string) {
  const res = await h.req("POST", "/api/orders", {
    auth: user,
    headers: { "X-Idempotency-Key": key() },
    body: sale([{ productId: product.id, quantity: 1 }], { cashReceived: 50, ...(customerName && { customerName }) }),
  });
  assert.equal(res.status, 201, res.text);
  return res.json.id as string;
}

async function orderIn(status: Status) {
  const id = await newOrder();
  if (status === "cancelled") {
    assert.equal((await h.req("PATCH", `/api/orders/${id}/status`, { auth: admin, body: { status } })).status, 200);
    return id;
  }
  for (const next of PATH.slice(1, PATH.indexOf(status) + 1)) {
    const r = await h.req("PATCH", `/api/orders/${id}/status`, { auth: cashier, body: { status: next } });
    assert.equal(r.status, 200, `${next}: ${r.text}`);
  }
  return id;
}

before(async () => {
  if (skip) return;
  await h.start();
  admin = await h.user("admin", "ADMIN");
  cashier = await h.user("cajero", "CAJERO");
  noPerms = await h.user("sinpermisos", []);
  cancelOnly = await h.user("solocancela", ["sales.cancel"]);
  product = await qaProduct(h, "americano", 30);
  await openFreshCashSession(h, admin);
});

after(async () => {
  if (skip) return;
  await closeAnyCashSession();
  await h.stop();
});

test("QA-ORD-01 matriz completa de transiciones (5×5) contra las reglas del servicio", { skip }, async () => {
  const mismatches: string[] = [];
  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const id = await orderIn(from);
      const res = await h.req("PATCH", `/api/orders/${id}/status`, { auth: admin, body: { status: to } });
      const allowed = ALLOWED[from].includes(to);
      const stored = (await prisma.order.findUniqueOrThrow({ where: { id } })).status;
      if (allowed && (res.status !== 200 || stored !== to)) mismatches.push(`${from}→${to}: esperado 200, obtuvo ${res.status}`);
      if (!allowed && (res.status !== 409 || stored !== from)) mismatches.push(`${from}→${to}: esperado 409, obtuvo ${res.status} (BD=${stored})`);
    }
  }
  assert.deepEqual(mismatches, []);
});

test("QA-ORD-02 completar o cancelar fija completedAt y queda en auditoría", { skip }, async () => {
  const id = await orderIn("completed");
  const row = await prisma.order.findUniqueOrThrow({ where: { id } });
  assert.ok(row.completedAt, "completedAt");
  const logs = await prisma.auditLog.count({ where: { action: "ORDER_STATUS_CHANGED", metadata: { path: ["orderId"], equals: id } } });
  assert.equal(logs, 3, "una entrada por transición");
});

test("QA-ORD-03 orden inexistente, id malformado y estado inválido", { skip }, async () => {
  const ghost = await h.req("PATCH", "/api/orders/00000000-0000-4000-8000-000000000000/status", { auth: admin, body: { status: "preparing" } });
  assert.equal(ghost.status, 404);
  const malformed = await h.req("PATCH", "/api/orders/not-a-uuid'--/status", { auth: admin, body: { status: "preparing" } });
  assert.ok([400, 404].includes(malformed.status), `id malformado → ${malformed.status}`);
  const id = await newOrder();
  const bad = await h.req("PATCH", `/api/orders/${id}/status`, { auth: admin, body: { status: "delivered" } });
  assert.equal(bad.status, 400);
  const detail404 = await h.req("GET", "/api/orders/00000000-0000-4000-8000-000000000000", { auth: admin });
  assert.equal(detail404.status, 404);
});

test("QA-ORD-04 permisos: sin sales.create no avanza; sin sales.cancel no cancela; ajeno → 403", { skip }, async () => {
  const id = await newOrder();
  const foreignAdvance = await h.req("PATCH", `/api/orders/${id}/status`, { auth: noPerms, body: { status: "preparing" } });
  assert.equal(foreignAdvance.status, 403);
  const cancelOnlyAdvance = await h.req("PATCH", `/api/orders/${id}/status`, { auth: cancelOnly, body: { status: "preparing" } });
  assert.equal(cancelOnlyAdvance.status, 403, "solo sales.cancel y ajena");
  const cashierCancel = await h.req("PATCH", `/api/orders/${id}/status`, { auth: cashier, body: { status: "cancelled" } });
  assert.equal(cashierCancel.status, 403);
  const foreignDetail = await h.req("GET", `/api/orders/${id}`, { auth: noPerms });
  assert.equal(foreignDetail.status, 403);
  const foreignList = await h.req("GET", "/api/orders", { auth: noPerms });
  assert.equal(foreignList.status, 200);
  assert.ok(!JSON.stringify(foreignList.json).includes(id), "no ve órdenes ajenas");
  const anonymous = await h.req("PATCH", `/api/orders/${id}/status`, { body: { status: "preparing" } });
  assert.equal(anonymous.status, 401);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id } })).status, "pending");
});

test("QA-ORD-05 cambios de estado concurrentes: uno gana, el resto 409, sin estados mezclados", { skip }, async () => {
  const id = await newOrder();
  const results = await Promise.all(Array.from({ length: 5 }, () =>
    h.req("PATCH", `/api/orders/${id}/status`, { auth: cashier, body: { status: "preparing" } })));
  const statuses = results.map((r) => r.status).sort();
  assert.equal(statuses.filter((s) => s === 200).length, 1, statuses.join(","));
  assert.ok(statuses.every((s) => s === 200 || s === 409), `sin 500: ${statuses.join(",")}`);
  const logs = await prisma.auditLog.count({ where: { action: "ORDER_STATUS_CHANGED", metadata: { path: ["orderId"], equals: id } } });
  assert.equal(logs, 1);
});

test("QA-ORD-06 avanzar y cancelar a la vez: estado final coherente con la caja", { skip }, async () => {
  for (let round = 0; round < 4; round++) {
    const id = await orderIn("preparing");
    const [ready, cancel] = await Promise.all([
      h.req("PATCH", `/api/orders/${id}/status`, { auth: admin, body: { status: "ready" } }),
      h.req("PATCH", `/api/orders/${id}/status`, { auth: admin, body: { status: "cancelled" } }),
    ]);
    const final = (await prisma.order.findUniqueOrThrow({ where: { id } })).status;
    const reversals = await prisma.cashMovement.count({ where: { referenceId: id, type: "sale_reversal" } });
    assert.ok([ready.status, cancel.status].every((s) => s === 200 || s === 409), `${ready.status}/${cancel.status}`);
    assert.equal(reversals, final === "cancelled" ? 1 : 0, `final=${final} reversas=${reversals}`);
  }
});

test("QA-ORD-07 filtros por estado, búsqueda por cliente, tablero y paginación", { skip }, async () => {
  const name = `${h.tag("cliente")}`;
  const readyId = await orderIn("ready");
  const named = await newOrder(cashier, name);
  for (const status of STATUSES) {
    const res = await h.req("GET", `/api/orders?status=${status}&limit=100`, { auth: admin });
    assert.equal(res.status, 200);
    assert.ok(res.json.data.every((o: { status: string }) => o.status === status), `filtro ${status}`);
  }
  const ready = await h.req("GET", "/api/orders?status=ready&limit=100", { auth: admin });
  assert.ok(ready.json.data.some((o: { id: string }) => o.id === readyId));
  const search = await h.req("GET", `/api/orders?search=${encodeURIComponent(name)}`, { auth: admin });
  assert.deepEqual(search.json.data.map((o: { id: string }) => o.id), [named]);
  const board = await h.req("GET", "/api/orders?board=true&limit=100", { auth: admin });
  assert.equal(board.status, 200);
  const p1 = await h.req("GET", "/api/orders?limit=2&page=1", { auth: admin });
  const p2 = await h.req("GET", "/api/orders?limit=2&page=2", { auth: admin });
  assert.equal(p1.json.data.length, 2);
  assert.notDeepEqual(p1.json.data.map((o: { id: string }) => o.id), p2.json.data.map((o: { id: string }) => o.id));
  for (const bad of ["status=foo", "limit=0", "limit=100000", "page=-1", "board=1", "unknown=1"]) {
    const res = await h.req("GET", `/api/orders?${bad}`, { auth: admin });
    assert.equal(res.status, 400, `?${bad} → ${res.status}`);
  }
});

test("QA-ORD-08 una orden cancelada no se edita ni se vuelve a cobrar", { skip }, async () => {
  const id = await orderIn("cancelled");
  const edit = await h.req("PATCH", `/api/orders/${id}`, { auth: admin, body: { notes: "x" } });
  assert.equal(edit.status, 409, `editar cancelada → ${edit.status}`);
  const request = await h.req("POST", `/api/orders/${id}/cancellation-requests`, { auth: admin, body: { reason: "otra vez" } });
  assert.equal(request.status, 409);
});

test("QA-ORD-09 cancelar una orden lista (ya preparada) revierte la caja", { skip }, async () => {
  const id = await orderIn("ready");
  const res = await h.req("PATCH", `/api/orders/${id}/status`, { auth: admin, body: { status: "cancelled", reason: "no la recogió" } });
  assert.equal(res.status, 200);
  assert.equal(await prisma.cashMovement.count({ where: { referenceId: id, type: "sale_reversal" } }), 1);
});

test("QA-ORD-10 otro usuario ve el cambio de estado de inmediato (sin caché del servidor)", { skip }, async () => {
  const id = await newOrder();
  await h.req("PATCH", `/api/orders/${id}/status`, { auth: cashier, body: { status: "preparing" } });
  const seenByAdmin = await h.req("GET", `/api/orders/${id}`, { auth: admin });
  assert.equal(seenByAdmin.json.status, "preparing");
});
