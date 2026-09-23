import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { CashService } from "../../src/services/cash.service";
import { OrderService } from "../../src/services/order.service";
import { ExpenseService } from "../../src/services/expense.service";
import { incomeStatementService } from "../../src/services/income-statement.service";
import { getZonedDayBoundaries } from "../../src/utils/businessDate";

// End-to-end coverage for the new Estado de Resultados module: a full day's cash
// flow (order -> payment -> expense -> cash close) aggregated through
// incomeStatementService.getDayFinancials, a multi-session PENDIENTE day, and the
// expense payment-method-change fix (services/expense.service.ts).

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();

// Fixed, backdated calendar day so the snapshot is always "final" regardless of
// when this test actually runs (date < today).
const TEST_DATE = "2026-01-15";

let unitId: string;
let ingredientId: string;
let productId: string;
let userId: string;
let registerAId: string;
let registerBId: string;
let sessionAId: string;
let sessionBId: string;
const orderIds: string[] = [];
const expenseIds: string[] = [];

const PRODUCT_PRICE = 100;
const PRODUCT_COST = 40;

before(async () => {
  if (!integrationEnabled) return;

  const unit = await prisma.inventoryUnit.create({ data: { name: `is-test-unit-${testId}`, abbreviation: "u" } });
  unitId = unit.id;

  const ingredient = await prisma.ingredient.create({
    data: { name: `is-test-ingredient-${testId}`, unitId, currentStock: 100, averageCost: 5 },
  });
  ingredientId = ingredient.id;

  const product = await prisma.product.create({
    data: {
      name: `is-test-product-${testId}`,
      sku: `IS-TEST-${testId}`,
      price: PRODUCT_PRICE,
      cost: PRODUCT_COST,
      isActive: true,
      recipes: { create: [{ ingredientId, quantity: 1 }] },
    },
  });
  productId = product.id;

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  const user = await prisma.user.create({
    data: {
      email: `is-test-user-${testId}@test.local`,
      name: "Income Statement Test User",
      passwordHash: "not-used-directly",
      roleId: adminRole.id,
      isActive: true,
    },
  });
  userId = user.id;

  const registerA = await prisma.cashRegister.create({ data: { name: `is-test-register-a-${testId}` } });
  registerAId = registerA.id;
  const registerB = await prisma.cashRegister.create({ data: { name: `is-test-register-b-${testId}` } });
  registerBId = registerB.id;
});

after(async () => {
  if (!integrationEnabled) return;

  await prisma.incomeStatementDailySnapshot.deleteMany({ where: { date: new Date(`${TEST_DATE}T00:00:00Z`) } });
  await prisma.notification.deleteMany({ where: { referenceId: { in: [sessionAId, sessionBId].filter(Boolean) } } });
  await prisma.payment.deleteMany({ where: { createdById: userId } });
  await prisma.cashMovement.deleteMany({ where: { cashSessionId: { in: [sessionAId, sessionBId].filter(Boolean) } } });
  await prisma.auditLog.deleteMany({ where: { cashSessionId: { in: [sessionAId, sessionBId].filter(Boolean) } } });
  await prisma.inventoryMovement.deleteMany({ where: { ingredientId } });
  await prisma.orderItem.deleteMany({ where: { productId } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.expense.deleteMany({ where: { id: { in: expenseIds } } });
  await prisma.cashSession.deleteMany({ where: { cashRegisterId: { in: [registerAId, registerBId] } } });
  await prisma.cashRegister.deleteMany({ where: { id: { in: [registerAId, registerBId] } } });
  await prisma.recipe.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.ingredient.deleteMany({ where: { id: ingredientId } });
  await prisma.inventoryUnit.deleteMany({ where: { id: unitId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

test(
  "getDayFinancials agrega ventas/gastos/caja de un día completo y persiste el snapshot final",
  { skip: !integrationEnabled },
  async () => {
    // Session A: opens, sells one unit (cash), closes with a deliberate faltante.
    const sessionA = await CashService.openSession({ openingAmount: 1000, cashRegisterId: registerAId }, userId);
    sessionAId = sessionA.id;

    const order = await OrderService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: "cash", cashReceived: PRODUCT_PRICE, cashSessionId: sessionAId },
      userId,
      `idem-${testId}-1`,
    );
    orderIds.push(order.id);
    // Revenue/COGS are only counted for completed orders (matches dashboard.repository.ts's
    // existing convention) — advance the order past the pending/preparing/ready workflow
    // directly, since exercising that state machine isn't this test's concern.
    await prisma.order.update({ where: { id: order.id }, data: { status: "completed", completedAt: new Date() } });

    const expense = await ExpenseService.create(
      { category: "insumos", description: "Gasto de prueba", amount: 20, paymentMethod: "cash" },
      userId,
    );
    expenseIds.push(expense.id);

    // expectedAmount should now be 1000 (opening) + 100 (cash sale) - 20 (cash expense) = 1080.
    const closed = await CashService.closeSession(userId, { closingAmount: 1060, reason: "Prueba de faltante" });
    assert.ok(closed);
    assert.equal(closed?.expectedAmount.toNumber(), 1080);
    assert.equal(closed?.difference?.toNumber(), -20);

    // Backdate everything created "now" to the fixed test date, in both directions of the boundary.
    const { start } = getZonedDayBoundaries(TEST_DATE);
    const backdated = new Date(start.getTime() + 12 * 60 * 60 * 1000); // local noon of TEST_DATE
    await prisma.cashSession.update({ where: { id: sessionAId }, data: { openedAt: backdated, closedAt: backdated } });
    await prisma.order.update({ where: { id: order.id }, data: { createdAt: backdated } });
    await prisma.payment.updateMany({ where: { orderId: order.id }, data: { paidAt: backdated } });
    await prisma.expense.update({ where: { id: expense.id }, data: { expenseDate: backdated } });

    const summary = await incomeStatementService.getDayFinancials(TEST_DATE);

    assert.equal(summary.hadOperation, true);
    assert.equal(summary.movimientos.ingresosEfectivo, PRODUCT_PRICE);
    assert.equal(summary.movimientos.ingresosTotales, PRODUCT_PRICE);
    // Cost of goods sold is informational only — it does not reduce gananciaNeta.
    assert.equal(summary.movimientos.costoVenta, PRODUCT_COST);
    assert.equal(summary.movimientos.gastos, 20);
    assert.equal(summary.movimientos.gananciaNeta, PRODUCT_PRICE - 20);
    assert.equal(summary.conciliacion.fondoInicial, 1000);
    assert.equal(summary.conciliacion.efectivoEsperado, 1080);
    assert.equal(summary.conciliacion.efectivoReal, 1060);
    assert.equal(summary.conciliacion.diferencia, -20);
    assert.equal(summary.conciliacion.estado, "FALTANTE");

    // Distribution (Ahorro/Fondo/Surtido) is applied to gananciaDistribuible (gananciaNeta minus
    // the fixed operating expense), not gananciaNeta directly — must sum exactly to it either way.
    // Nothing is distributed when it is zero or negative (e.g. here: 100 - 20 - fixed expenses).
    const distTotal = summary.distribucion.ahorro + summary.distribucion.fondoNegocio + summary.distribucion.surtido;
    const expectedDistributed = Math.max(0, summary.distribucion.gananciaDistribuible);
    assert.ok(Math.abs(distTotal - expectedDistributed) < 0.001, `distributed ${distTotal}, expected ${expectedDistributed}`);

    // The day is in the past and fully closed -> a final snapshot must have been persisted.
    const snapshot = await prisma.incomeStatementDailySnapshot.findUnique({
      where: { date: new Date(`${TEST_DATE}T00:00:00Z`) },
    });
    assert.ok(snapshot, "expected a persisted final snapshot for a past, fully-closed day");
    assert.equal(snapshot?.isFinal, true);
    assert.equal(snapshot?.savingsAccumulated.toNumber(), summary.saldosAcumulados.ahorroAcumulado);
  },
);

test(
  "un día con una sesión todavía abierta se reporta como PENDIENTE, sin inventar un cierre",
  { skip: !integrationEnabled },
  async () => {
    const sessionB = await CashService.openSession({ openingAmount: 300, cashRegisterId: registerBId }, userId);
    sessionBId = sessionB.id;

    const { start } = getZonedDayBoundaries(TEST_DATE);
    const backdated = new Date(start.getTime() + 13 * 60 * 60 * 1000);
    await prisma.cashSession.update({ where: { id: sessionBId }, data: { openedAt: backdated } });

    const summary = await incomeStatementService.getDayFinancials(TEST_DATE);

    assert.equal(summary.conciliacion.sessionsCount, 2); // session A (closed) + session B (open)
    assert.equal(summary.conciliacion.openSessionsCount, 1);
    assert.equal(summary.conciliacion.estado, "PENDIENTE");
    assert.equal(summary.conciliacion.efectivoReal, null);
    assert.equal(summary.conciliacion.efectivoEsperado, 1080 + 300);
  },
);

test(
  "editar el método de pago de un gasto de efectivo a transferencia revierte su impacto en caja",
  { skip: !integrationEnabled },
  async () => {
    const openSession = await CashService.getActiveSession();
    assert.ok(openSession, "expected session B to still be open");
    const expectedBefore = openSession!.expectedAmount.toNumber();

    const expense = await ExpenseService.create(
      { category: "otros", description: "Gasto a reclasificar", amount: 50, paymentMethod: "cash" },
      userId,
    );
    expenseIds.push(expense.id);

    const afterCashExpense = await prisma.cashSession.findUniqueOrThrow({ where: { id: openSession!.id } });
    assert.equal(afterCashExpense.expectedAmount.toNumber(), expectedBefore - 50);

    // Reclassify to transfer: the cash impact must be reversed, not left decremented.
    await ExpenseService.update(expense.id, { paymentMethod: "transfer" }, userId);

    const afterReclassify = await prisma.cashSession.findUniqueOrThrow({ where: { id: openSession!.id } });
    assert.equal(afterReclassify.expectedAmount.toNumber(), expectedBefore);

    const updatedExpense = await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } });
    assert.equal(updatedExpense.cashSessionId, null);
  },
);
