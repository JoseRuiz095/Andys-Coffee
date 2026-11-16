import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import type { AuthUser } from "../../src/services/auth.service";
import { CashService } from "../../src/services/cash.service";
import { ExpenseService } from "../../src/services/expense.service";
import { OrderService } from "../../src/services/order.service";
import { UserService } from "../../src/services/user.service";
import { RoleService } from "../../src/services/role.service";
import { PurchaseService } from "../../src/services/purchase.service";
import { incomeStatementService } from "../../src/services/income-statement.service";
import { getTodayInZone } from "../../src/utils/businessDate";

// P1 findings of the stabilization audit (2026-11-14): F2, N-1, F3, F5, IS-3, EX-1 (N-3), A1,
// IS-4 and INV-4. Tests run in order and share one cash register; each leaves no open drawer.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();
const PRICE = 100;

let admin: AuthUser;
let delegate: AuthUser;
let productId: string;
let ingredientId: string;
let unitId: string;
let registerId: string;
let delegateRoleId: string;
let adminTargetId: string;
const orderIds: string[] = [];
const sessionIds: string[] = [];
const userIds: string[] = [];
const roleIds: string[] = [];
let seq = 0;

const expectedOf = async (sessionId: string) =>
  (await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionId } })).expectedAmount.toNumber();

async function openDrawer(amount = 500) {
  const session = await CashService.openSession({ openingAmount: amount, cashRegisterId: registerId }, admin.id);
  sessionIds.push(session.id);
  return session;
}

async function closeDrawer() {
  const open = await CashService.getActiveSession();
  if (open) await CashService.closeSession(admin.id, { closingAmount: Number(open.expectedAmount) });
}

async function sell(extra: Record<string, unknown> = {}, key = `p1-${testId}-${++seq}`) {
  const order = await OrderService.create(
    { items: [{ productId, quantity: 1 }], paymentMethod: "cash", cashReceived: PRICE, ...extra } as Parameters<typeof OrderService.create>[0],
    admin.id,
    key,
  );
  orderIds.push(order.id);
  return order;
}

before(async () => {
  if (!integrationEnabled) return;
  await prisma.cashSession.updateMany({ where: { status: "open" }, data: { status: "closed", closedAt: new Date() } });
  const unit = await prisma.inventoryUnit.create({ data: { name: `p1-unit-${testId}`, abbreviation: `p1-${testId}` } });
  unitId = unit.id;
  const ingredient = await prisma.ingredient.create({ data: { name: `p1-ingredient-${testId}`, unitId, currentStock: 100, averageCost: 2 } });
  ingredientId = ingredient.id;
  const product = await prisma.product.create({ data: { name: `p1-product-${testId}`, sku: `P1-${testId}`, price: PRICE, cost: 40, isActive: true } });
  productId = product.id;
  const register = await prisma.cashRegister.create({ data: { name: `p1-register-${testId}` } });
  registerId = register.id;

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" }, include: { permissions: { include: { permission: true } } } });
  const adminRecord = await prisma.user.create({ data: { email: `p1-admin-${testId}@test.local`, name: "P1 Admin", passwordHash: "unused", roleId: adminRole.id } });
  userIds.push(adminRecord.id);
  admin = {
    id: adminRecord.id, name: adminRecord.name, email: adminRecord.email, roleId: adminRole.id, roleName: "ADMIN", isActive: true,
    permissions: adminRole.permissions.map(({ permission }) => permission.name),
  };

  // A second ADMIN user (target of A1) and a delegated user manager that is not an admin.
  const target = await prisma.user.create({ data: { email: `p1-admin2-${testId}@test.local`, name: "P1 Admin 2", passwordHash: "unused", roleId: adminRole.id } });
  adminTargetId = target.id;
  userIds.push(target.id);
  const delegatePermissions = ["users.read", "users.update", "users.delete"];
  const perms = await prisma.permission.findMany({ where: { name: { in: delegatePermissions } } });
  const delegateRole = await prisma.role.create({
    data: { name: `p1-delegate-${testId}`, permissions: { create: perms.map((p) => ({ permissionId: p.id })) } },
  });
  delegateRoleId = delegateRole.id;
  roleIds.push(delegateRole.id);
  const delegateRecord = await prisma.user.create({ data: { email: `p1-delegate-${testId}@test.local`, name: "P1 Delegate", passwordHash: "unused", roleId: delegateRole.id } });
  userIds.push(delegateRecord.id);
  delegate = { id: delegateRecord.id, name: delegateRecord.name, email: delegateRecord.email, roleId: delegateRole.id, roleName: delegateRole.name, isActive: true, permissions: delegatePermissions };
});

after(async () => {
  if (!integrationEnabled) return;
  await closeDrawer();
  const today = new Date(`${getTodayInZone()}T00:00:00Z`);
  await prisma.incomeStatementDailySnapshot.deleteMany({ where: { date: today, isFinal: false } });
  await prisma.notification.deleteMany({ where: { referenceId: { in: [...sessionIds, ...orderIds] } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.orderCancellationRequest.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.expense.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.cashMovement.deleteMany({ where: { cashSessionId: { in: sessionIds } } });
  await prisma.inventoryMovement.deleteMany({ where: { ingredientId } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.purchase.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.cashSession.deleteMany({ where: { cashRegisterId: registerId } });
  await prisma.cashRegister.deleteMany({ where: { id: registerId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.ingredient.deleteMany({ where: { id: ingredientId } });
  await prisma.inventoryUnit.deleteMany({ where: { id: unitId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
});

test("F2: el gasto automático de un mandadito no se edita ni se borra por separado", { skip: !integrationEnabled }, async () => {
  await openDrawer();
  const order = await sell({ hasDelivery: true, deliveryAmount: 50, deliveryResponsible: "business_absorbs" });
  const expense = await prisma.expense.findFirstOrThrow({ where: { sourceOrderId: order.id } });
  await assert.rejects(ExpenseService.update(expense.id, { paymentMethod: "transfer" }, admin.id), { name: "ConflictError" });
  await assert.rejects(ExpenseService.remove(expense.id, admin.id), { name: "ConflictError" });

  // Cancelling the (undelivered) sale gives back exactly what the drawer lost.
  const session = await CashService.getActiveSession();
  const before = await expectedOf(session!.id);
  await OrderService.updateStatus(order.id, { status: "cancelled", reason: "prueba F2" }, admin);
  assert.equal(await expectedOf(session!.id), before - PRICE + 50, "venta devuelta (−100) y mandadito de vuelta al cajón (+50)");
  await closeDrawer();
});

test("N-1: cancelar una venta ya entregada no devuelve al cajón el mandadito que se pagó", { skip: !integrationEnabled }, async () => {
  const session = await openDrawer();
  const order = await sell({ hasDelivery: true, deliveryAmount: 40, deliveryResponsible: "business_absorbs" });
  for (const status of ["preparing", "ready", "completed"] as const) {
    await OrderService.updateStatus(order.id, { status }, admin);
  }
  const before = await expectedOf(session.id);
  // An admin (sales.approve_cancellation) approves their own request in the same call.
  await OrderService.requestCancellation(order.id, { reason: "cliente devolvió el pedido" }, admin);

  assert.equal(await expectedOf(session.id), before - PRICE, "solo se devuelve la venta; el repartidor ya cobró");
  const expense = await prisma.expense.findFirst({ where: { sourceOrderId: order.id } });
  assert.ok(expense, "el gasto del mandadito pagado se conserva");
  await closeDrawer();
});

test("F3: la misma clave con otro carrito se rechaza; el reintento idéntico devuelve la misma venta", { skip: !integrationEnabled }, async () => {
  await openDrawer();
  const key = `p1-${testId}-retry`;
  const first = await sell({}, key);
  const retry = await OrderService.create({ items: [{ productId, quantity: 1 }], paymentMethod: "cash", cashReceived: PRICE } as Parameters<typeof OrderService.create>[0], admin.id, key);
  assert.equal(retry.id, first.id);
  await assert.rejects(
    OrderService.create({ items: [{ productId, quantity: 2 }], paymentMethod: "cash", cashReceived: 2 * PRICE } as Parameters<typeof OrderService.create>[0], admin.id, key),
    { name: "ConflictError" },
  );
  assert.equal(await prisma.order.count({ where: { createdById: admin.id, idempotencyKey: key } }), 1);
  await closeDrawer();
});

test("F5: solo se reabre el corte más reciente y sin otra caja abierta", { skip: !integrationEnabled }, async () => {
  const older = await openDrawer(100);
  await closeDrawer();
  const latest = await openDrawer(200);
  await closeDrawer();

  await assert.rejects(CashService.reopenSession(older.id, admin.id, "prueba"), /más reciente/);

  const other = await prisma.cashRegister.create({ data: { name: `p1-other-${testId}` } });
  const otherSession = await CashService.openSession({ openingAmount: 10, cashRegisterId: other.id }, admin.id);
  await assert.rejects(CashService.reopenSession(latest.id, admin.id, "prueba"), /Hay una caja abierta/);
  await CashService.closeSession(admin.id, { closingAmount: 10 });
  await prisma.cashMovement.deleteMany({ where: { cashSessionId: otherSession.id } });
  await prisma.notification.deleteMany({ where: { referenceId: otherSession.id } });
  await prisma.cashSession.delete({ where: { id: otherSession.id } });
  await prisma.cashRegister.delete({ where: { id: other.id } });

  const reopened = await CashService.reopenSession(latest.id, admin.id, "conteo mal capturado");
  assert.equal(reopened.status, "open");
  await closeDrawer();
});

test("IS-3: los saldos acumulados de hoy se pueden corregir y la corrección se conserva", { skip: !integrationEnabled }, async () => {
  const today = getTodayInZone();
  // A small correction (the service rejects jumps above twice the day's net profit).
  const current = (await incomeStatementService.getDayFinancials(today)).saldosAcumulados;
  const target = {
    ahorroAcumulado: current.ahorroAcumulado + 0.5,
    fondoNegocioAcumulado: current.fondoNegocioAcumulado,
    surtidoAcumulado: current.surtidoAcumulado,
  };
  const updated = await incomeStatementService.updateAccumulatedBalances(today, target);
  assert.deepEqual(
    [updated.saldosAcumulados.ahorroAcumulado, updated.saldosAcumulados.fondoNegocioAcumulado, updated.saldosAcumulados.surtidoAcumulado],
    [target.ahorroAcumulado, target.fondoNegocioAcumulado, target.surtidoAcumulado],
  );
  // A sale or expense of today invalidates frozen snapshots but must keep this correction.
  await openDrawer();
  await ExpenseService.create({ category: "otros", description: `p1-is3-${testId}`, amount: 1, paymentMethod: "cash" }, admin.id);
  const again = await incomeStatementService.getDayFinancials(today);
  assert.equal(again.saldosAcumulados.ahorroAcumulado, target.ahorroAcumulado);
  await closeDrawer();
});

test("EX-1 (N-3): un gasto en efectivo sin caja abierta se rechaza; con transferencia sí se registra", { skip: !integrationEnabled }, async () => {
  assert.equal(await CashService.getActiveSession(), null);
  await assert.rejects(
    ExpenseService.create({ category: "otros", description: `p1-cash-${testId}`, amount: 30, paymentMethod: "cash" }, admin.id),
    /No hay una caja abierta/,
  );
  const transfer = await ExpenseService.create({ category: "otros", description: `p1-transfer-${testId}`, amount: 30, paymentMethod: "transfer" }, admin.id);
  assert.equal(transfer.cashSessionId, null);
  // Becoming a cash expense also needs an open drawer.
  await assert.rejects(ExpenseService.update(transfer.id, { paymentMethod: "cash" }, admin.id), /No hay una caja abierta/);
});

test("A1: quien administra usuarios sin ser admin no puede modificar a un ADMIN ni recortar roles más privilegiados", { skip: !integrationEnabled }, async () => {
  await assert.rejects(UserService.setActive(adminTargetId, false, delegate), { name: "AuthorizationError" });
  await assert.rejects(UserService.update(adminTargetId, { email: `p1-hijack-${testId}@test.local` }, delegate), { name: "AuthorizationError" });
  await assert.rejects(UserService.deleteUser(adminTargetId, delegate), { name: "AuthorizationError" });

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  await assert.rejects(RoleService.assignPermissions(adminRole.id, [], delegate), { name: "AuthorizationError" });

  // A user whose role the delegate fully covers can still be managed.
  const peerRecord = await prisma.user.create({ data: { email: `p1-peer-${testId}@test.local`, name: "P1 Peer", passwordHash: "unused", roleId: delegateRoleId } });
  userIds.push(peerRecord.id);
  const updated = await UserService.update(peerRecord.id, { name: "P1 Peer editado" }, delegate);
  assert.equal(updated.name, "P1 Peer editado");
});

test("IS-4/INV-4: la compra se imputa al día de recepción y un borrador recibido no se puede borrar", { skip: !integrationEnabled }, async () => {
  const purchase = await PurchaseService.create(
    { items: [{ ingredientId, quantity: "10", unitCost: "3" }] } as Parameters<typeof PurchaseService.create>[0],
    admin,
    `p1-purchase-${testId}`,
  );
  const draftDate = new Date("2026-01-05T15:00:00Z");
  await prisma.purchase.update({ where: { id: purchase.id }, data: { purchasedAt: draftDate } });

  const before = Date.now();
  const received = await PurchaseService.receivePurchase(purchase.id, admin);
  assert.ok(received.purchasedAt.getTime() >= before, "fecha de recepción, no la del borrador");

  await assert.rejects(PurchaseService.deletePurchase(purchase.id, admin), { name: "ConflictError" });
  assert.ok(await prisma.purchase.findUnique({ where: { id: purchase.id } }));
});
