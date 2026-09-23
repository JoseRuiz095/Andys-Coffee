import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Prisma } from "@prisma/client";
import { prisma } from "../../src/config/prisma";
import type { AuthUser } from "../../src/services/auth.service";
import { CashService } from "../../src/services/cash.service";
import { ExpenseService } from "../../src/services/expense.service";
import { OrderService } from "../../src/services/order.service";
import { expectedAmountEffect } from "../../src/jobs/cashReconciliation.job";

// TD-10: every cash movement stores its signed drawer effect, so the movements of a session
// (except CLOSING) add up exactly to its expectedAmount. This drives every writer through
// the services: sale, cancellation, expense create/edit/delete, and the three mandadito flows.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();

let admin: AuthUser;
let productId: string;
let ingredientId: string;
let unitId: string;
let registerId: string;
let sessionId: string;
const orderIds: string[] = [];
const createdUserIds: string[] = [];

let seq = 0;
async function sell(extra: Record<string, unknown> = {}) {
  seq += 1;
  const order = await OrderService.create(
    { items: [{ productId, quantity: 1 }], paymentMethod: "cash", cashReceived: 100, cashSessionId: sessionId, ...extra } as Parameters<typeof OrderService.create>[0],
    admin.id,
    `sign-${testId}-${seq}`,
  );
  orderIds.push(order.id);
  return order;
}

before(async () => {
  if (!integrationEnabled) return;

  const unit = await prisma.inventoryUnit.create({ data: { name: `sign-unit-${testId}`, abbreviation: "u" } });
  unitId = unit.id;
  const ingredient = await prisma.ingredient.create({ data: { name: `sign-ingredient-${testId}`, unitId, currentStock: 1000, averageCost: 5 } });
  ingredientId = ingredient.id;
  const product = await prisma.product.create({
    data: { name: `sign-product-${testId}`, sku: `SIGN-${testId}`, price: 100, cost: 40, isActive: true, recipes: { create: [{ ingredientId, quantity: 1 }] } },
  });
  productId = product.id;
  const register = await prisma.cashRegister.create({ data: { name: `sign-register-${testId}` } });
  registerId = register.id;

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" }, include: { permissions: { include: { permission: true } } } });
  const adminRecord = await prisma.user.create({
    data: { email: `sign-admin-${testId}@test.local`, name: "Sign Admin", passwordHash: "unused", roleId: adminRole.id },
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

  const session = await CashService.openSession({ openingAmount: 500, cashRegisterId: registerId }, admin.id);
  sessionId = session.id;
});

after(async () => {
  if (!integrationEnabled) return;

  await prisma.notification.deleteMany({ where: { referenceId: { in: [sessionId, ...orderIds] } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.expense.deleteMany({ where: { createdById: { in: createdUserIds } } });
  await prisma.cashMovement.deleteMany({ where: { cashSessionId: sessionId } });
  await prisma.inventoryMovement.deleteMany({ where: { ingredientId } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.cashSession.deleteMany({ where: { cashRegisterId: registerId } });
  await prisma.cashRegister.deleteMany({ where: { id: registerId } });
  await prisma.recipe.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.ingredient.deleteMany({ where: { id: ingredientId } });
  await prisma.inventoryUnit.deleteMany({ where: { id: unitId } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

test("los movimientos de una sesión suman exactamente su expectedAmount (TD-10)", { skip: !integrationEnabled }, async () => {
  // Plain cash sale, then one cancelled (sale + sale_reversal).
  await sell();
  const cancelled = await sell();
  await OrderService.updateStatus(cancelled.id, { status: "cancelled", reason: "prueba de signos" }, admin);

  // Expense lifecycle: create 50, edit to 30, create another 20 and delete it.
  const expense = await ExpenseService.create({ category: "insumos", description: `sign-${testId}`, amount: 50, paymentMethod: "cash" }, admin.id);
  await ExpenseService.update(expense.id, { amount: 30 }, admin.id);
  const removed = await ExpenseService.create({ category: "otros", description: `sign-del-${testId}`, amount: 20, paymentMethod: "cash" }, admin.id);
  await ExpenseService.remove(removed.id, admin.id);

  // Mandaditos: cash collected for the courier and handed off; absorbed by the business and
  // then cancelled (expense + expense_reversal); collected and cancelled before the handoff.
  const collected = await sell({ hasDelivery: true, deliveryAmount: 25, deliveryResponsible: "customer_to_business", deliveryPaymentMethod: "cash" });
  await OrderService.handoffDelivery(collected.id, admin);
  const absorbed = await sell({ hasDelivery: true, deliveryAmount: 15, deliveryResponsible: "business_absorbs" });
  await OrderService.updateStatus(absorbed.id, { status: "cancelled", reason: "prueba de signos" }, admin);
  const collectedCancelled = await sell({ hasDelivery: true, deliveryAmount: 10, deliveryResponsible: "customer_to_business", deliveryPaymentMethod: "cash" });
  await OrderService.updateStatus(collectedCancelled.id, { status: "cancelled", reason: "prueba de signos" }, admin);

  const session = await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionId }, include: { movements: true } });
  const types = new Set(session.movements.map((movement) => movement.type));
  for (const type of ["OPENING", "sale", "sale_reversal", "expense", "expense_adjustment", "expense_reversal", "delivery_collected", "delivery_handoff", "delivery_collected_reversal"]) {
    assert.ok(types.has(type as never), `falta un movimiento ${type} en la sesión`);
  }

  // Money out is negative, money in positive.
  for (const movement of session.movements) {
    const isOut = ["sale_reversal", "expense", "delivery_handoff", "delivery_collected_reversal"].includes(movement.type)
      || (movement.type === "expense_adjustment" && movement.amount.isNegative());
    if (isOut) assert.ok(movement.amount.lte(0), `${movement.type} debería restar: ${movement.amount.toString()}`);
    if (["OPENING", "sale", "delivery_collected", "expense_reversal"].includes(movement.type)) {
      assert.ok(movement.amount.gte(0), `${movement.type} debería sumar: ${movement.amount.toString()}`);
    }
  }

  const sum = session.movements.reduce((total, movement) => total.plus(expectedAmountEffect(movement.type, movement.amount)), new Prisma.Decimal(0));
  assert.equal(sum.toString(), session.expectedAmount.toString());

  // 500 opening + 100 sale + (100 - 100) cancelled - 30 expense + (20 - 20) deleted
  // + 100 sale + 25 - 25 (handed off) + (100 - 100) + (-15 + 15) absorbed + (100 - 100) + (10 - 10) = 670
  assert.equal(session.expectedAmount.toString(), "670");
});
