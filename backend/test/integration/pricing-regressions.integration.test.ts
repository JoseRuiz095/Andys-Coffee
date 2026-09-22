import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { CashService } from "../../src/services/cash.service";
import { OrderService } from "../../src/services/order.service";
import { getCalendarDateAsUtc, getTodayInZone } from "../../src/utils/businessDate";

// L-05 (combo price split), L-06 (extras cost), L-07 (promotion on its last day).
// Seeded promotions are paused during this file so results don't depend on the weekday.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();

let userId: string;
let registerId: string;
let sessionId: string;
let productIds: string[] = [];
let comboId: string;
let extraId: string;
let promotionId: string;
let categoryId: string | undefined;
let pausedPromotionIds: string[] = [];
const orderIds: string[] = [];
let seq = 0;

async function order(items: unknown[]) {
  seq += 1;
  const created = await OrderService.create(
    { items, paymentMethod: "transfer" } as Parameters<typeof OrderService.create>[0],
    userId,
    `pricing-${testId}-${seq}`,
  );
  orderIds.push(created.id);
  return prisma.order.findUniqueOrThrow({ where: { id: created.id }, include: { items: { include: { extras: true } } } });
}

before(async () => {
  if (!integrationEnabled) return;

  const active = await prisma.promotion.findMany({ where: { isActive: true }, select: { id: true } });
  pausedPromotionIds = active.map((p) => p.id);
  await prisma.promotion.updateMany({ where: { id: { in: pausedPromotionIds } }, data: { isActive: false } });

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  userId = (await prisma.user.create({
    data: { email: `pricing-${testId}@test.local`, name: "Pricing", passwordHash: "unused", roleId: adminRole.id },
  })).id;

  const products = await Promise.all(["A", "B", "C"].map((suffix) => prisma.product.create({
    data: { name: `pricing-${suffix}-${testId}`, sku: `PRC-${suffix}-${testId}`, price: 50, cost: 10, isActive: true },
  })));
  productIds = products.map((p) => p.id);

  comboId = (await prisma.combo.create({
    data: {
      name: `pricing-combo-${testId}`,
      price: 100,
      isActive: true,
      activeOnDays: [], // every day
      items: { create: productIds.map((productId) => ({ productId, quantity: 1 })) },
    },
  })).id;

  extraId = (await prisma.extra.create({ data: { name: `pricing-extra-${testId}`, price: 8, cost: 3, isActive: true } })).id;
  await prisma.productExtra.create({ data: { productId: productIds[0], extraId } });

  registerId = (await prisma.cashRegister.create({ data: { name: `pricing-register-${testId}` } })).id;
  sessionId = (await CashService.openSession({ openingAmount: 0, cashRegisterId: registerId }, userId)).id;
});

after(async () => {
  if (!integrationEnabled) return;
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.notification.deleteMany({ where: { referenceId: { in: [...orderIds, sessionId] } } });
  await prisma.cashMovement.deleteMany({ where: { cashSessionId: sessionId } });
  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.cashSession.deleteMany({ where: { cashRegisterId: registerId } });
  await prisma.cashRegister.deleteMany({ where: { id: registerId } });
  if (promotionId) await prisma.promotion.deleteMany({ where: { id: promotionId } });
  await prisma.productExtra.deleteMany({ where: { extraId } });
  await prisma.extra.deleteMany({ where: { id: extraId } });
  await prisma.combo.deleteMany({ where: { id: comboId } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.promotion.updateMany({ where: { id: { in: pausedPromotionIds } }, data: { isActive: true } });
});

test("L-05: el precio de un combo se reparte en centavos exactos (las líneas suman el precio del combo)", { skip: !integrationEnabled }, async () => {
  const created = await order([{ comboId, quantity: 1 }]);
  const subtotals = created.items.map((item) => item.subtotal.toNumber()).sort();
  assert.deepEqual(subtotals, [33.33, 33.33, 33.34]);
  const linesTotal = created.items.reduce((sum, item) => sum + item.subtotal.toNumber(), 0);
  assert.equal(Math.round(linesTotal * 100), 10000);
  assert.equal(created.subtotal.toNumber(), 100);
  assert.equal(created.total.toNumber(), 100);
});

test("L-06: el costo guardado de un extra es por la cantidad vendida y entra en el costo del pedido", { skip: !integrationEnabled }, async () => {
  const created = await order([{ productId: productIds[0], quantity: 1, extras: [{ extraId, quantity: 2 }] }]);
  const extra = created.items[0].extras[0];
  assert.equal(extra.costSnapshot?.toNumber(), 6); // 2 × 3
  assert.equal(created.totalCost?.toNumber(), 10 + 6);
});

test("L-07: una promoción aplica también en su último día (endDate = hoy)", { skip: !integrationEnabled }, async () => {
  const { date: today } = getCalendarDateAsUtc(getTodayInZone());
  promotionId = (await prisma.promotion.create({
    data: {
      name: `pricing-promo-${testId}`, type: "PERCENTAGE", discountValue: 10, startDate: today, endDate: today, activeOnDays: [], isActive: true,
      products: { create: { productId: productIds[1] } },
    },
  })).id;

  const created = await order([{ productId: productIds[1], quantity: 1 }]);
  assert.equal(created.discount.toNumber(), 5); // 10% of 50
  assert.equal(created.total.toNumber(), 45);
});

test("N-01: la promoción solo descuenta a los productos (o categorías) vinculados", { skip: !integrationEnabled }, async () => {
  // The L-07 promotion above is linked to product B only.
  const linked = await order([{ productId: productIds[1], quantity: 1 }]);
  assert.equal(linked.discount.toNumber(), 5);
  const notLinked = await order([{ productId: productIds[2], quantity: 1 }]);
  assert.equal(notLinked.discount.toNumber(), 0, "a product outside the promotion pays full price");

  // Category link: every product of the category gets it.
  const category = await prisma.category.create({ data: { name: `pricing-cat-${testId}` } });
  categoryId = category.id;
  await prisma.product.update({ where: { id: productIds[2] }, data: { categoryId: category.id } });
  await prisma.promotionOnCategory.create({ data: { promotionId, categoryId: category.id } });
  const byCategory = await order([{ productId: productIds[2], quantity: 1 }]);
  assert.equal(byCategory.discount.toNumber(), 5);
});

