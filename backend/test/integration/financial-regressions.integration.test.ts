import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { app } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { createJwtToken, type AuthUser } from "../../src/services/auth.service";
import { CashService } from "../../src/services/cash.service";
import { ExpenseService } from "../../src/services/expense.service";
import { incomeStatementService } from "../../src/services/income-statement.service";
import { InventoryService } from "../../src/services/inventory.service";
import { OrderService } from "../../src/services/order.service";
import { UserService } from "../../src/services/user.service";
import { ProductService } from "../../src/services/product.service";
import { dashboardRepository } from "../../src/repositories/dashboard.repository";
import { dashboardService } from "../../src/services/dashboard.service";
import { getZonedCalendarDate, getZonedDayBoundaries } from "../../src/utils/businessDate";

// Regression coverage for the Fase 6 fixes (docs/Project/auditoria-mvp-2026-09-22.md):
// C-01, C-02, H-01, H-02, H-03, H-04, H-05, M-02, M-04.
// Tests in this file run in order and share one cash register.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();

// Past calendar days (always < today) so income-statement snapshots become final.
const DAY_H04 = "2026-02-10";
const DAY_C01 = "2026-02-11";
const DAY_R03 = "2026-02-12";

const PRODUCT_PRICE = 100;
const PRODUCT_COST = 40;

let server: Server;
let baseUrl: string;
let admin: AuthUser;
let noSalesUser: AuthUser;
let unitId: string;
let ingredientId: string;
let productId: string;
let registerId: string;
let noSalesRoleId: string;
const sessionIds: string[] = [];
const orderIds: string[] = [];
const expenseIds: string[] = [];
const createdUserIds: string[] = [];

let orderSeq = 0;
function createOrder(paymentMethod: "cash" | "pending", extra: { customerName?: string } = {}) {
  orderSeq += 1;
  return OrderService.create(
    {
      items: [{ productId, quantity: 1 }],
      paymentMethod,
      ...(paymentMethod === "cash" ? { cashReceived: PRODUCT_PRICE } : {}),
      ...extra,
    } as Parameters<typeof OrderService.create>[0],
    admin.id,
    `fin-reg-${testId}-${orderSeq}`,
  ).then((order) => {
    orderIds.push(order.id);
    return order;
  });
}

async function openSession(openingAmount: number) {
  const session = await CashService.openSession({ openingAmount, cashRegisterId: registerId }, admin.id);
  sessionIds.push(session.id);
  return session;
}

before(async () => {
  if (!integrationEnabled) return;

  const unit = await prisma.inventoryUnit.create({ data: { name: `fin-unit-${testId}`, abbreviation: "u" } });
  unitId = unit.id;
  const ingredient = await prisma.ingredient.create({
    data: { name: `fin-ingredient-${testId}`, unitId, currentStock: 1000, averageCost: 5 },
  });
  ingredientId = ingredient.id;
  const product = await prisma.product.create({
    data: {
      name: `fin-product-${testId}`,
      sku: `FIN-${testId}`,
      price: PRODUCT_PRICE,
      cost: PRODUCT_COST,
      isActive: true,
      recipes: { create: [{ ingredientId, quantity: 1 }] },
    },
  });
  productId = product.id;
  const register = await prisma.cashRegister.create({ data: { name: `fin-register-${testId}` } });
  registerId = register.id;

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "ADMIN" },
    include: { permissions: { include: { permission: true } } },
  });
  const adminRecord = await prisma.user.create({
    data: { email: `fin-admin-${testId}@test.local`, name: "Fin Admin", passwordHash: "unused", roleId: adminRole.id },
  });
  createdUserIds.push(adminRecord.id);
  admin = {
    id: adminRecord.id,
    name: adminRecord.name,
    email: adminRecord.email,
    roleId: adminRole.id,
    roleName: "ADMIN",
    isActive: true,
    permissions: adminRole.permissions.map(({ permission }) => permission.name),
  };

  const noSalesRole = await prisma.role.create({ data: { name: `fin-no-sales-${testId}` } });
  noSalesRoleId = noSalesRole.id;
  const noSalesRecord = await prisma.user.create({
    data: { email: `fin-nosales-${testId}@test.local`, name: "No Sales", passwordHash: "unused", roleId: noSalesRole.id },
  });
  createdUserIds.push(noSalesRecord.id);
  noSalesUser = {
    id: noSalesRecord.id,
    name: noSalesRecord.name,
    email: noSalesRecord.email,
    roleId: noSalesRole.id,
    roleName: noSalesRole.name,
    isActive: true,
    permissions: [],
  };

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (!integrationEnabled) return;

  await prisma.incomeStatementDailySnapshot.deleteMany({
    where: { date: { in: [DAY_H04, DAY_C01, DAY_R03].map((d) => new Date(`${d}T00:00:00Z`)) } },
  });
  await prisma.notification.deleteMany({ where: { referenceId: { in: [...sessionIds, ...orderIds] } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.expense.deleteMany({ where: { id: { in: expenseIds } } });
  await prisma.cashMovement.deleteMany({ where: { cashSessionId: { in: sessionIds } } });
  await prisma.inventoryMovement.deleteMany({ where: { ingredientId } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.cashSession.deleteMany({ where: { cashRegisterId: registerId } });
  await prisma.cashRegister.deleteMany({ where: { id: registerId } });
  await prisma.recipe.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.ingredient.deleteMany({ where: { id: ingredientId } });
  await prisma.inventoryUnit.deleteMany({ where: { id: unitId } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.role.deleteMany({ where: { id: noSalesRoleId } });
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("C-02: cancelar una venta de una caja cerrada no altera ese corte; la devolución va a la caja abierta", { skip: !integrationEnabled }, async () => {
  const sessionA = await openSession(500);
  const order = await createOrder("cash");
  const closedA = await CashService.closeSession(admin.id, { closingAmount: 600 });
  assert.equal(closedA?.expectedAmount.toNumber(), 600);
  assert.equal(closedA?.difference?.toNumber(), 0);

  // With no open drawer there is nowhere to take the refund from.
  await assert.rejects(
    OrderService.updateStatus(order.id, { status: "cancelled" }, admin),
    (error: Error) => error.name === "BusinessRuleError",
  );

  const sessionB = await openSession(200);
  const stockBefore = (await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } })).currentStock.toNumber();
  await OrderService.updateStatus(order.id, { status: "cancelled" }, admin);

  const afterA = await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionA.id } });
  assert.equal(afterA.expectedAmount.toNumber(), 600, "closed cut must not change");
  assert.equal(afterA.difference?.toNumber(), 0);

  const afterB = await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionB.id } });
  assert.equal(afterB.expectedAmount.toNumber(), 100, "refund leaves today's drawer");

  const reversal = await prisma.cashMovement.findFirstOrThrow({
    where: { referenceId: order.id, type: "sale_reversal" },
  });
  assert.equal(reversal.cashSessionId, sessionB.id);
  assert.equal(reversal.amount.toNumber(), -PRODUCT_PRICE);

  // C-07: the sale consumed nothing, so cancelling it doesn't touch stock either.
  const stockAfter = (await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } })).currentStock.toNumber();
  assert.equal(stockAfter, stockBefore, "a sale without inventory consumption is not reversed in stock");
});

test("H-02: dos liquidaciones simultáneas del mismo pago pendiente solo registran el efectivo una vez", { skip: !integrationEnabled }, async () => {
  const session = await CashService.getActiveSession();
  assert.ok(session);
  const expectedBefore = session!.expectedAmount.toNumber();

  const order = await createOrder("pending", { customerName: "Paga después" });
  const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });

  const results = await Promise.allSettled([
    OrderService.settlePayment(payment.id, "cash", admin),
    OrderService.settlePayment(payment.id, "cash", admin),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, JSON.stringify(results.map((r) => r.status)));

  const saleMovements = await prisma.cashMovement.count({ where: { referenceId: order.id, type: "sale" } });
  assert.equal(saleMovements, 1);
  const after = await prisma.cashSession.findUniqueOrThrow({ where: { id: session!.id } });
  assert.equal(after.expectedAmount.toNumber(), expectedBefore + PRODUCT_PRICE);
});

test("H-03: cancelar un pedido con pago pendiente cancela el pago y ya no se puede liquidar", { skip: !integrationEnabled }, async () => {
  const order = await createOrder("pending", { customerName: "Se arrepintió" });
  const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });

  await OrderService.updateStatus(order.id, { status: "cancelled" }, admin);

  const cancelledPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  assert.equal(cancelledPayment.status, "cancelled");

  const pending = await OrderService.getPendingPayments(admin);
  assert.equal(pending.some((p) => p.id === payment.id), false);

  await assert.rejects(
    OrderService.settlePayment(payment.id, "cash", admin),
    (error: Error) => error.name === "BusinessRuleError",
  );
});

test("H-03b: cancelar un pago pendiente liquidado en efectivo en otra caja devuelve ese efectivo", { skip: !integrationEnabled }, async () => {
  const sessionA = await CashService.getActiveSession();
  assert.ok(sessionA);
  const order = await createOrder("pending", { customerName: "Paga mañana" });
  await CashService.closeSession(admin.id, { closingAmount: sessionA!.expectedAmount.toNumber() });

  // Settled in cash in a later session: the `sale` movement lands in session B, not in the
  // session the order was created in.
  const sessionB = await openSession(300);
  const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
  await OrderService.settlePayment(payment.id, "cash", admin);
  const settledB = await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionB.id } });
  assert.equal(settledB.expectedAmount.toNumber(), 300 + PRODUCT_PRICE);

  await OrderService.updateStatus(order.id, { status: "cancelled" }, admin);

  const reversal = await prisma.cashMovement.findFirstOrThrow({
    where: { referenceId: order.id, type: "sale_reversal" },
  });
  assert.equal(reversal.cashSessionId, sessionB.id);
  assert.equal(reversal.amount.toNumber(), -PRODUCT_PRICE);

  const afterB = await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionB.id } });
  assert.equal(afterB.expectedAmount.toNumber(), 300, "the settled cash leaves the drawer again");

  const afterA = await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionA!.id } });
  assert.equal(afterA.expectedAmount.toNumber(), sessionA!.expectedAmount.toNumber(), "closed cut must not change");
});

test("C-12: liquidar en efectivo registra lo recibido y el cambio; recibir menos se rechaza", { skip: !integrationEnabled }, async () => {
  const order = await createOrder("pending", { customerName: "Paga con billete" });
  const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });

  await assert.rejects(
    OrderService.settlePayment(payment.id, "cash", admin, PRODUCT_PRICE - 1),
    (error: Error) => error.name === "BusinessRuleError",
  );
  assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, "pending", "nothing settled");

  await OrderService.settlePayment(payment.id, "cash", admin, PRODUCT_PRICE + 50);
  const movement = await prisma.cashMovement.findFirstOrThrow({ where: { referenceId: order.id, type: "sale" } });
  assert.equal(movement.amount.toNumber(), PRODUCT_PRICE);
  assert.equal(movement.receivedAmount?.toNumber(), PRODUCT_PRICE + 50);
  assert.equal(movement.changeAmount?.toNumber(), 50);
});

test("C-07: cancelar una venta antigua que sí consumió insumos los devuelve; la caja se revierte igual", { skip: !integrationEnabled }, async () => {
  const session = await CashService.getActiveSession();
  assert.ok(session);
  const order = await createOrder("cash");
  // Simulate a sale from before 2026-10-20, when sales consumed the recipe.
  await prisma.ingredient.update({ where: { id: ingredientId }, data: { currentStock: { decrement: 1 } } });
  await prisma.inventoryMovement.create({
    data: { ingredientId, type: "sale", quantity: -1, referenceType: "order", referenceId: order.id, createdById: admin.id },
  });
  await prisma.order.update({ where: { id: order.id }, data: { inventoryProcessed: true } });
  const stockBefore = (await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } })).currentStock.toNumber();
  const expectedBefore = (await prisma.cashSession.findUniqueOrThrow({ where: { id: session!.id } })).expectedAmount.toNumber();

  await OrderService.updateStatus(order.id, { status: "cancelled" }, admin);

  const stockAfter = (await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } })).currentStock.toNumber();
  assert.equal(stockAfter, stockBefore + 1, "legacy consumption is given back");
  const expectedAfter = (await prisma.cashSession.findUniqueOrThrow({ where: { id: session!.id } })).expectedAmount.toNumber();
  assert.equal(expectedAfter, expectedBefore - PRODUCT_PRICE, "the cash refund doesn't depend on inventory");
  const cancelled = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(cancelled.inventoryProcessed, false);
});

test("R-02/H-04: un pedido pagado cuenta como ingreso aunque no esté completado; cancelarlo recalcula su día", { skip: !integrationEnabled }, async () => {
  const order = await createOrder("cash");
  const { start } = getZonedDayBoundaries(DAY_H04);
  await prisma.order.update({ where: { id: order.id }, data: { createdAt: new Date(start.getTime() + 12 * 3600 * 1000) } });

  // Still "pending" in the kitchen, but paid: it is revenue (R-02). The past day gets frozen.
  const before = await incomeStatementService.getDayFinancials(DAY_H04);
  assert.equal(before.movimientos.ingresosTotales, PRODUCT_PRICE);
  assert.equal(before.movimientos.costoVenta, PRODUCT_COST);
  const frozen = await prisma.incomeStatementDailySnapshot.findUnique({ where: { date: new Date(`${DAY_H04}T00:00:00Z`) } });
  assert.equal(frozen?.isFinal, true);

  // Moving it through the kitchen does not change revenue.
  await OrderService.updateStatus(order.id, { status: "preparing" }, admin);
  assert.equal((await incomeStatementService.getDayFinancials(DAY_H04)).movimientos.ingresosTotales, PRODUCT_PRICE);

  // Cancelling it drops the frozen snapshot, so the day no longer shows that revenue (H-04).
  await OrderService.updateStatus(order.id, { status: "cancelled" }, admin);
  const after = await incomeStatementService.getDayFinancials(DAY_H04);
  assert.equal(after.movimientos.ingresosTotales, 0);
  assert.equal(after.movimientos.costoVenta, 0);
});

test("C-01: un gasto con fecha pasada cuenta en el estado de resultados de ese día, también después de editarlo", { skip: !integrationEnabled }, async () => {
  const expense = await ExpenseService.create(
    { category: "otros", description: "Gasto con fecha pasada", amount: 35, paymentMethod: "transfer", expenseDate: DAY_C01 },
    admin.id,
  );
  expenseIds.push(expense.id);
  assert.equal(getZonedCalendarDate(expense.expenseDate), DAY_C01);

  const summary = await incomeStatementService.getDayFinancials(DAY_C01);
  assert.equal(summary.movimientos.gastos, 35);

  // The edit form always resends the date: an unrelated edit must keep the stored instant.
  await ExpenseService.update(expense.id, { description: "Gasto con fecha pasada (editado)", expenseDate: DAY_C01 }, admin.id);
  const edited = await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } });
  assert.equal(edited.expenseDate.getTime(), expense.expenseDate.getTime());

  const afterEdit = await incomeStatementService.getDayFinancials(DAY_C01);
  assert.equal(afterEdit.movimientos.gastos, 35);
});

test("R-03: un gasto fuera del horario de negocio cuenta en el día y se reporta aparte", { skip: !integrationEnabled }, async () => {
  const expense = await ExpenseService.create(
    { category: "otros", description: "Compra nocturna", amount: 42, paymentMethod: "transfer", expenseDate: DAY_R03 },
    admin.id,
  );
  expenseIds.push(expense.id);
  // 03:00 local: outside any configured business hours.
  const { start } = getZonedDayBoundaries(DAY_R03);
  await prisma.expense.update({ where: { id: expense.id }, data: { expenseDate: new Date(start.getTime() + 3 * 3600 * 1000) } });

  const summary = await incomeStatementService.getDayFinancials(DAY_R03);
  assert.equal(summary.movimientos.gastos, 42);
  assert.equal(summary.movimientos.gastosFueraDeHorario, 42);

  // The frozen snapshot keeps the breakdown too.
  const snapshot = await prisma.incomeStatementDailySnapshot.findUniqueOrThrow({ where: { date: new Date(`${DAY_R03}T00:00:00Z`) } });
  assert.equal(snapshot.expensesOutsideHours.toNumber(), 42);
  const cached = await incomeStatementService.getDayFinancials(DAY_R03);
  assert.equal(cached.movimientos.gastosFueraDeHorario, 42);
});

test("M-02: reabrir una caja deja en la auditoría el conteo que se descarta", { skip: !integrationEnabled }, async () => {
  const session = await CashService.getActiveSession();
  assert.ok(session);
  const counted = session!.expectedAmount.toNumber() - 5;
  await CashService.closeSession(admin.id, { closingAmount: counted, reason: "Faltante de prueba" });

  const reopened = await CashService.reopenSession(session!.id, admin.id, "Conteo mal capturado");
  assert.equal(reopened.status, "open");
  assert.equal(reopened.closingAmount, null);

  const audit = await prisma.auditLog.findFirstOrThrow({
    where: { cashSessionId: session!.id, action: "CASH_SESSION_REOPENED" },
  });
  const metadata = audit.metadata as Record<string, unknown>;
  assert.equal(Number(metadata.previousClosingAmount), counted);
  assert.equal(Number(metadata.previousDifference), -5);
  assert.equal(metadata.reason, "Conteo mal capturado");
});

test("M-04: no se puede crear un usuario con un rol más privilegiado que el propio", { skip: !integrationEnabled }, async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  const limitedActor: AuthUser = { ...noSalesUser, permissions: ["users.create"] };

  await assert.rejects(
    UserService.create(
      { name: "Intruso", email: `fin-intruso-${testId}@test.local`, password: "Password123!", roleId: adminRole.id },
      limitedActor,
    ),
    (error: Error) => error.name === "AuthorizationError",
  );
  assert.equal(await prisma.user.count({ where: { email: `fin-intruso-${testId}@test.local` } }), 0);
});

test("H-01: POST /api/orders exige sales.create", { skip: !integrationEnabled }, async () => {
  const csrf = await fetch(`${baseUrl}/api/auth/csrf`);
  const token = ((await csrf.json()) as { token: string }).token;
  const cookie = csrf.headers.get("set-cookie")!.split(";")[0];

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      "X-CSRF-TOKEN": token,
      "X-Idempotency-Key": `fin-reg-http-${testId}`,
      Authorization: `Bearer ${createJwtToken(noSalesUser)}`,
    },
    body: JSON.stringify({ items: [{ productId, quantity: 1 }], paymentMethod: "cash", cashReceived: PRODUCT_PRICE }),
  });
  assert.equal(response.status, 403);
  assert.equal(await prisma.order.count({ where: { createdById: noSalesUser.id } }), 0);
});

test("H-05: un usuario con inventory.create_ingredient puede activar y desactivar ingredientes", { skip: !integrationEnabled }, async () => {
  await InventoryService.setIngredientActive(ingredientId, false, admin);
  assert.equal((await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } })).isActive, false);
  await InventoryService.setIngredientActive(ingredientId, true, admin);
  assert.equal((await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } })).isActive, true);
});

test("R-04: el detalle del producto sugiere el costo según receta × costo promedio", { skip: !integrationEnabled }, async () => {
  const detail = await ProductService.findOne(productId);
  assert.ok(detail);
  assert.equal(detail!.cost.toNumber(), PRODUCT_COST, "the manual cost is untouched");
  assert.equal(detail!.suggestedCost?.toNumber(), 5); // 1 unit × averageCost 5

  // Averages move with purchases, and the suggestion follows them.
  await prisma.ingredient.update({ where: { id: ingredientId }, data: { averageCost: 7.255 } });
  assert.equal((await ProductService.findOne(productId))!.suggestedCost?.toNumber(), 7.26);
});

test("Dashboard: la tendencia de ventas agrupa por día de negocio (una venta a las 23:30 locales no cae al día siguiente)", { skip: !integrationEnabled }, async () => {
  const DAY = "2026-02-13";
  const order = await createOrder("cash");
  const { start, end } = getZonedDayBoundaries(DAY);
  // 23:30 in Mexico City = 05:30Z of the next UTC day.
  await prisma.order.update({ where: { id: order.id }, data: { createdAt: new Date(start.getTime() + 23.5 * 3600 * 1000) } });

  const trend = await dashboardRepository.getSalesTrend(start, end);
  assert.equal(trend.length, 1);
  assert.equal(trend[0].date, DAY);
  assert.equal(trend[0].revenue, PRODUCT_PRICE);
});

test("Dashboard: el resumen coincide con el estado de resultados y la tendencia rellena los días sin ventas", { skip: !integrationEnabled }, async () => {
  const FROM = "2026-02-10";
  const TO = "2026-02-13";
  const query = { period: "customRange" as const, from: FROM, to: TO };

  const [summary, statement, trend, evolution] = await Promise.all([
    dashboardService.getSummary(query),
    incomeStatementService.getRangeFinancials(FROM, TO),
    dashboardService.getSalesTrend(query),
    dashboardService.getCostEvolution(query),
  ]);

  assert.equal(summary.revenue, statement.totals.ingresosTotales);
  assert.equal(summary.expenses, statement.totals.gastos);
  assert.equal(summary.profit, statement.totals.gananciaNeta);
  assert.equal(summary.fixedExpenses, statement.totals.gastosOperativosFijos);

  const days = ["2026-02-10", "2026-02-11", "2026-02-12", "2026-02-13"];
  assert.deepEqual(trend.data.map((row) => row.date), days);
  assert.deepEqual(evolution.data.map((row) => row.date), days);
});
