import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { CashService } from "../../src/services/cash.service";
import { ExtraService } from "../../src/services/extra.service";
import { MenuService } from "../../src/services/menu.service";
import { OrderService } from "../../src/services/order.service";

// C-09: extras are managed in the catalog, linked to products, offered by the menu and sold
// from the POS (priced per unit of the product).

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();

let userId: string;
let categoryId: string;
let productId: string;
let registerId: string;
let sessionId: string;
const extraIds: string[] = [];
const orderIds: string[] = [];

before(async () => {
  if (!integrationEnabled) return;
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  userId = (await prisma.user.create({
    data: { email: `extras-${testId}@test.local`, name: "Extras", passwordHash: "unused", roleId: adminRole.id },
  })).id;
  categoryId = (await prisma.category.create({ data: { name: `extras-cat-${testId}` } })).id;
  productId = (await prisma.product.create({
    data: { name: `extras-bagel-${testId}`, sku: `EXTRAS-${testId}`, price: 60, cost: 20, isActive: true, categoryId },
  })).id;
  registerId = (await prisma.cashRegister.create({ data: { name: `extras-register-${testId}` } })).id;
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
  await prisma.productExtra.deleteMany({ where: { productId } });
  await prisma.extra.deleteMany({ where: { id: { in: extraIds } } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

const menuProduct = async () =>
  (await MenuService.getFullMenu()).flatMap((category) => category.items).find((item) => item.id === productId) as
    | { extras?: { id: string; name: string; price: number }[] }
    | undefined;

test("un extra se crea, se vincula al producto y aparece en el menú", { skip: !integrationEnabled }, async () => {
  const cheese = await ExtraService.create({ name: `Queso ${testId}`, price: 12, cost: 4 });
  const bacon = await ExtraService.create({ name: `Tocino ${testId}`, price: 18, cost: 7 });
  extraIds.push(cheese.id, bacon.id);

  await assert.rejects(ExtraService.create({ name: ` queso ${testId} `.toUpperCase(), price: 1, cost: 0 }), { name: "ConflictError" });

  const product = await ExtraService.setProductExtras(productId, [cheese.id, bacon.id]);
  assert.equal(product?.extras.length, 2);

  const offered = await menuProduct();
  assert.deepEqual(offered?.extras?.map((extra) => extra.price).sort(), [12, 18]);
});

test("la venta cobra el extra por unidad y lo guarda con su costo", { skip: !integrationEnabled }, async () => {
  const [cheeseId] = extraIds;
  const items = [{ productId, quantity: 2, extras: [{ extraId: cheeseId, quantity: 1 }] }];
  const quote = await OrderService.quote({ items } as Parameters<typeof OrderService.quote>[0]);
  assert.equal(quote.total, "144.00"); // 2 × (60 + 12)

  const order = await OrderService.create(
    { items, paymentMethod: "transfer" } as Parameters<typeof OrderService.create>[0],
    userId,
    `extras-${testId}-1`,
  );
  orderIds.push(order.id);
  assert.equal(order.total.toNumber(), 144);
  const [line] = order.items;
  assert.equal(line.extras[0].quantity.toNumber(), 2);
  assert.equal(line.extras[0].subtotal.toNumber(), 24);
  assert.equal(line.extras[0].costSnapshot?.toNumber(), 8);
});

test("un extra vendido no se elimina; desactivado deja de ofrecerse y de venderse", { skip: !integrationEnabled }, async () => {
  const [cheeseId, baconId] = extraIds;
  await assert.rejects(ExtraService.delete(cheeseId), { name: "ConflictError" });

  await ExtraService.setActive(cheeseId, false);
  const offered = await menuProduct();
  assert.deepEqual(offered?.extras?.map((extra) => extra.id), [baconId]);

  await assert.rejects(
    OrderService.quote({ items: [{ productId, quantity: 1, extras: [{ extraId: cheeseId, quantity: 1 }] }] } as Parameters<typeof OrderService.quote>[0]),
    { name: "ValidationError" },
  );

  // Never sold: it can be deleted (and its product link goes with it).
  await ExtraService.delete(baconId);
  extraIds.splice(extraIds.indexOf(baconId), 1);
  assert.equal(await prisma.productExtra.count({ where: { extraId: baconId } }), 0);
});
