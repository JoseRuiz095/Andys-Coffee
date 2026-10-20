import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import type { AuthUser } from "../../src/services/auth.service";
import { CashService } from "../../src/services/cash.service";
import { OrderService } from "../../src/services/order.service";

// C-08: a completed sale can only be cancelled with an admin's approval. The cashier asks
// (with a reason), the admin approves — which runs the normal cancellation reversals — or
// rejects it. An admin's own request is approved at once.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();
const PRICE = 80;

let productId: string;
let registerId: string;
let sessionId: string;
let admin: AuthUser;
let cashier: AuthUser;
const userIds: string[] = [];
const orderIds: string[] = [];
let seq = 0;

async function userWithRole(roleName: "ADMIN" | "CAJERO"): Promise<AuthUser> {
  const role = await prisma.role.findUniqueOrThrow({
    where: { name: roleName },
    include: { permissions: { include: { permission: true } } },
  });
  const record = await prisma.user.create({
    data: { email: `cancel-${roleName}-${testId}@test.local`, name: `Cancel ${roleName}`, passwordHash: "unused", roleId: role.id },
  });
  userIds.push(record.id);
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    roleId: role.id,
    roleName,
    isActive: true,
    permissions: role.permissions.map(({ permission }) => permission.name),
  };
}

/** A cash sale taken all the way to `completed`. */
async function completedSale() {
  seq += 1;
  const order = await OrderService.create(
    { items: [{ productId, quantity: 1 }], paymentMethod: "cash", cashReceived: PRICE } as Parameters<typeof OrderService.create>[0],
    cashier.id,
    `cancel-${testId}-${seq}`,
  );
  orderIds.push(order.id);
  for (const status of ["preparing", "ready", "completed"] as const) {
    await OrderService.updateStatus(order.id, { status }, cashier);
  }
  return order;
}

const expectedCash = async () =>
  (await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionId } })).expectedAmount.toNumber();

before(async () => {
  if (!integrationEnabled) return;
  productId = (await prisma.product.create({
    data: { name: `cancel-product-${testId}`, sku: `CANCEL-${testId}`, price: PRICE, cost: 30, isActive: true },
  })).id;
  registerId = (await prisma.cashRegister.create({ data: { name: `cancel-register-${testId}` } })).id;
  admin = await userWithRole("ADMIN");
  cashier = await userWithRole("CAJERO");
  sessionId = (await CashService.openSession({ openingAmount: 0, cashRegisterId: registerId }, admin.id)).id;
});

after(async () => {
  if (!integrationEnabled) return;
  await prisma.notification.deleteMany({ where: { referenceId: { in: [...orderIds, sessionId] } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.cashMovement.deleteMany({ where: { cashSessionId: sessionId } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } }); // cascades to requests
  await prisma.cashSession.deleteMany({ where: { cashRegisterId: registerId } });
  await prisma.cashRegister.deleteMany({ where: { id: registerId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

test("el permiso de aprobar es solo del admin", { skip: !integrationEnabled }, async () => {
  assert.ok(admin.permissions?.includes("sales.approve_cancellation"));
  assert.equal(cashier.permissions?.includes("sales.approve_cancellation"), false);
});

test("una venta completada no se cancela directo: el cajero solicita y el admin aprueba", { skip: !integrationEnabled }, async () => {
  const order = await completedSale();
  await assert.rejects(OrderService.updateStatus(order.id, { status: "cancelled" }, admin), { name: "StateTransitionError" });

  const cashBefore = await expectedCash();
  const request = await OrderService.requestCancellation(order.id, { reason: "El cliente devolvió el pedido" }, cashier);
  assert.equal(request.status, "pending");
  assert.equal(await expectedCash(), cashBefore, "asking moves no money");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "completed");

  // Only one pending request per sale.
  await assert.rejects(
    OrderService.requestCancellation(order.id, { reason: "Otra vez" }, cashier),
    { name: "ConflictError" },
  );
  // The cashier can't approve it.
  await assert.rejects(OrderService.reviewCancellation(request.id, "approve", {}, cashier), { name: "AuthorizationError" });

  const pending = await OrderService.getPendingCancellationRequests(admin);
  assert.ok(pending.some((entry) => entry.id === request.id && entry.order.id === order.id));
  const notified = await prisma.notificationRecipient.count({
    where: { userId: admin.id, notification: { referenceId: order.id, title: "Cancelación por aprobar" } },
  });
  assert.equal(notified, 1, "approvers are notified");

  const approved = await OrderService.reviewCancellation(request.id, "approve", { comment: "Ok" }, admin);
  assert.equal(approved.status, "approved");
  assert.equal(approved.reviewedBy?.id, admin.id);

  const cancelled = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
  assert.equal(cancelled.status, "cancelled");
  assert.ok(cancelled.payments.every((payment) => payment.status === "cancelled"));
  assert.equal(await expectedCash(), cashBefore - PRICE, "the cash refund leaves the drawer");
  const reversal = await prisma.cashMovement.findFirstOrThrow({ where: { referenceId: order.id, type: "sale_reversal" } });
  assert.equal(reversal.amount.toNumber(), -PRICE);

  await assert.rejects(OrderService.reviewCancellation(request.id, "reject", {}, admin), { name: "BusinessRuleError" });
});

test("rechazar deja la venta completada y permite volver a solicitar", { skip: !integrationEnabled }, async () => {
  const order = await completedSale();
  const cashBefore = await expectedCash();
  const request = await OrderService.requestCancellation(order.id, { reason: "Error de captura" }, cashier);

  const rejected = await OrderService.reviewCancellation(request.id, "reject", { comment: "La venta es correcta" }, admin);
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.reviewComment, "La venta es correcta");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "completed");
  assert.equal(await expectedCash(), cashBefore);

  const toCashier = await prisma.notificationRecipient.count({
    where: { userId: cashier.id, notification: { referenceId: order.id, title: "Cancelación rechazada" } },
  });
  assert.equal(toCashier, 1, "the requester learns the decision");

  const again = await OrderService.requestCancellation(order.id, { reason: "Nuevo motivo" }, cashier);
  assert.equal(again.status, "pending");
});

test("la solicitud del admin se aprueba en el acto", { skip: !integrationEnabled }, async () => {
  const order = await completedSale();
  const cashBefore = await expectedCash();
  const request = await OrderService.requestCancellation(order.id, { reason: "Cobro duplicado" }, admin);
  assert.equal(request.status, "approved");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "cancelled");
  assert.equal(await expectedCash(), cashBefore - PRICE);
});

test("solo se solicita aprobación para ventas completadas", { skip: !integrationEnabled }, async () => {
  seq += 1;
  const order = await OrderService.create(
    { items: [{ productId, quantity: 1 }], paymentMethod: "transfer" } as Parameters<typeof OrderService.create>[0],
    cashier.id,
    `cancel-${testId}-${seq}`,
  );
  orderIds.push(order.id);
  await assert.rejects(
    OrderService.requestCancellation(order.id, { reason: "Aún no se entrega" }, cashier),
    { name: "BusinessRuleError" },
  );
});

test("dos aprobaciones simultáneas solo devuelven el efectivo una vez", { skip: !integrationEnabled }, async () => {
  const order = await completedSale();
  const request = await OrderService.requestCancellation(order.id, { reason: "Prueba de concurrencia" }, cashier);
  const results = await Promise.allSettled([
    OrderService.reviewCancellation(request.id, "approve", {}, admin),
    OrderService.reviewCancellation(request.id, "approve", {}, admin),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1, JSON.stringify(results.map((r) => r.status)));
  assert.equal(await prisma.cashMovement.count({ where: { referenceId: order.id, type: "sale_reversal" } }), 1);
});
