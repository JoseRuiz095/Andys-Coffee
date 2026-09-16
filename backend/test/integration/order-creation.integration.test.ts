import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { OrderService } from "../../src/services/order.service";

// Coverage for OrderService.create, the largest and most financially critical function
// in the codebase (pricing, inventory deduction, cash posting). Also exercises the P1-1
// fix: product/combo/extra lookups now happen inside the Serializable transaction.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();

let unitId: string;
let ingredientId: string;
let productId: string;
let userId: string;
let cashRegisterId: string;
let cashSessionId: string;

const RECIPE_QUANTITY_PER_UNIT = 2;
const INITIAL_STOCK = 10;
const PRODUCT_PRICE = 50;
const PRODUCT_COST = 20;

before(async () => {
  if (!integrationEnabled) return;

  const unit = await prisma.inventoryUnit.create({
    data: { name: `order-test-unit-${testId}`, abbreviation: "u" },
  });
  unitId = unit.id;

  const ingredient = await prisma.ingredient.create({
    data: {
      name: `order-test-ingredient-${testId}`,
      unitId,
      currentStock: INITIAL_STOCK,
      averageCost: 5,
    },
  });
  ingredientId = ingredient.id;

  const product = await prisma.product.create({
    data: {
      name: `order-test-product-${testId}`,
      sku: `ORDER-TEST-${testId}`,
      price: PRODUCT_PRICE,
      cost: PRODUCT_COST,
      isActive: true,
      recipes: {
        create: [{ ingredientId, quantity: RECIPE_QUANTITY_PER_UNIT }],
      },
    },
  });
  productId = product.id;

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  const user = await prisma.user.create({
    data: {
      email: `order-test-user-${testId}@test.local`,
      name: "Order Test User",
      passwordHash: "not-used-directly",
      roleId: adminRole.id,
      isActive: true,
    },
  });
  userId = user.id;

  const cashRegister = await prisma.cashRegister.create({
    data: { name: `order-test-register-${testId}` },
  });
  cashRegisterId = cashRegister.id;

  const cashSession = await prisma.cashSession.create({
    data: {
      cashRegisterId,
      openedById: userId,
      openingAmount: 0,
      expectedAmount: 0,
      status: "open",
    },
  });
  cashSessionId = cashSession.id;
});

after(async () => {
  if (!integrationEnabled) return;

  const ordersCreated = await prisma.order.findMany({ where: { createdById: userId }, select: { id: true } });
  await prisma.notification.deleteMany({ where: { referenceId: { in: ordersCreated.map((o) => o.id) } } });
  await prisma.payment.deleteMany({ where: { createdById: userId } });
  await prisma.cashMovement.deleteMany({ where: { createdById: userId } });
  await prisma.inventoryMovement.deleteMany({ where: { ingredientId } });
  await prisma.orderItem.deleteMany({ where: { productId } });
  await prisma.order.deleteMany({ where: { createdById: userId } });
  await prisma.cashSession.deleteMany({ where: { id: cashSessionId } });
  await prisma.cashRegister.deleteMany({ where: { id: cashRegisterId } });
  await prisma.recipe.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.ingredient.deleteMany({ where: { id: ingredientId } });
  await prisma.inventoryUnit.deleteMany({ where: { id: unitId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

test(
  "OrderService.create calcula el total, descuenta inventario y registra el movimiento de caja",
  { skip: !integrationEnabled },
  async () => {
    const quantity = 2;
    const order = await OrderService.create(
      {
        items: [{ productId, quantity }],
        paymentMethod: "cash",
        cashReceived: PRODUCT_PRICE * quantity,
        cashSessionId,
      },
      userId,
      `idem-${testId}-1`,
    );

    assert.equal(order.total.toNumber(), PRODUCT_PRICE * quantity);
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].quantity.toNumber(), quantity);

    const ingredient = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
    assert.equal(
      ingredient.currentStock.toNumber(),
      INITIAL_STOCK - RECIPE_QUANTITY_PER_UNIT * quantity,
    );

    const session = await prisma.cashSession.findUniqueOrThrow({ where: { id: cashSessionId } });
    assert.equal(session.expectedAmount.toNumber(), PRODUCT_PRICE * quantity);

    const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
    assert.ok(payment);
    assert.equal(payment?.amount.toNumber(), PRODUCT_PRICE * quantity);

    // Notifications are now dispatched after the transaction commits; confirm the
    // extraction still delivers one for a freshly created order.
    const notification = await prisma.notification.findFirst({ where: { referenceId: order.id } });
    assert.ok(notification, "expected a notification to be created for the new order");
  },
);

test(
  "OrderService.create es idempotente: la misma idempotencyKey no crea un segundo pedido",
  { skip: !integrationEnabled },
  async () => {
    const idempotencyKey = `idem-${testId}-2`;
    const payload = {
      items: [{ productId, quantity: 1 }],
      paymentMethod: "cash" as const,
      cashReceived: PRODUCT_PRICE,
      cashSessionId,
    };

    const first = await OrderService.create(payload, userId, idempotencyKey);
    const second = await OrderService.create(payload, userId, idempotencyKey);

    assert.equal(first.id, second.id);
  },
);

test(
  "OrderService.create rechaza la venta si no hay stock suficiente",
  { skip: !integrationEnabled },
  async () => {
    await assert.rejects(
      OrderService.create(
        {
          items: [{ productId, quantity: 999 }],
          paymentMethod: "cash",
          cashReceived: PRODUCT_PRICE * 999,
          cashSessionId,
        },
        userId,
        `idem-${testId}-3`,
      ),
      (error: Error) => error.name === "BusinessRuleError",
    );
  },
);
