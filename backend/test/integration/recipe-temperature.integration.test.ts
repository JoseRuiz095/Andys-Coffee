import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import type { AuthUser } from "../../src/services/auth.service";
import { OrderService } from "../../src/services/order.service";
import { ProductService } from "../../src/services/product.service";

// Recipes per temperature (2026-11-16): a Latte sold hot and cold consumes the lines marked BOTH
// plus those of the temperature sold (hot: hot cup, more milk; cold: cold cup, ice, less milk).

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();
const tag = testId.slice(0, 8);
const PRICE = 60;

let admin: AuthUser;
let categoryId: string;
let registerId: string;
let sessionId: string;
let productId: string;
let comboId: string | null = null;
let previousConsume: string | null = null;
const ids: Record<"coffee" | "milk" | "hotCup" | "coldCup" | "ice", string> = { coffee: "", milk: "", hotCup: "", coldCup: "", ice: "" };

const stock = async (id: string) => (await prisma.ingredient.findUniqueOrThrow({ where: { id } })).currentStock.toNumber();
let keyCounter = 0;
const sell = (temperature: "HOT" | "COLD") =>
  OrderService.create(
    { items: [{ productId, quantity: 1, temperature }], paymentMethod: "cash", cashReceived: PRICE, cashSessionId: sessionId },
    admin.id,
    `rtemp-${testId}-${++keyCounter}`,
  );

before(async () => {
  if (!integrationEnabled) return;
  const gram = await prisma.inventoryUnit.findFirstOrThrow({ where: { abbreviation: "gr" } });
  const ml = await prisma.inventoryUnit.findFirstOrThrow({ where: { abbreviation: "ml" } });
  const piece = await prisma.inventoryUnit.findFirstOrThrow({ where: { abbreviation: "pz" } });
  const make = (key: keyof typeof ids, unitId: string, stockValue: number) =>
    prisma.ingredient.create({ data: { name: `RTEMP ${key} ${tag}`, sku: `RTEMP-${key}-${tag}`, unitId, currentStock: stockValue, averageCost: 1 } })
      .then((created) => { ids[key] = created.id; });
  await Promise.all([make("coffee", gram.id, 1000), make("milk", ml.id, 5000), make("hotCup", piece.id, 50), make("coldCup", piece.id, 50), make("ice", gram.id, 5000)]);
  categoryId = (await prisma.category.create({ data: { name: `RTEMP bebidas ${tag}`, isBeverage: true } })).id;

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" }, include: { permissions: { include: { permission: true } } } });
  const user = await prisma.user.create({ data: { email: `rtemp-${testId}@test.local`, name: "RTEMP Admin", passwordHash: "unused", roleId: adminRole.id } });
  admin = {
    id: user.id, name: user.name, email: user.email, roleId: adminRole.id, roleName: "ADMIN", isActive: true,
    permissions: adminRole.permissions.map(({ permission }) => permission.name),
  };
  registerId = (await prisma.cashRegister.create({ data: { name: `rtemp-register-${testId}` } })).id;
  sessionId = (await prisma.cashSession.create({
    data: { cashRegisterId: registerId, openedById: user.id, openingAmount: 0, expectedAmount: 0, status: "open" },
  })).id;

  previousConsume = (await prisma.systemPreference.findUnique({ where: { key: "inventory.consumeOnSale" } }))?.value ?? null;
  await prisma.systemPreference.upsert({
    where: { key: "inventory.consumeOnSale" },
    update: { value: "true" },
    create: { key: "inventory.consumeOnSale", value: "true", type: "boolean" },
  });
});

after(async () => {
  if (!integrationEnabled) return;
  await prisma.systemPreference.update({ where: { key: "inventory.consumeOnSale" }, data: { value: previousConsume ?? "false" } });
  const orders = await prisma.order.findMany({ where: { createdById: admin.id }, select: { id: true } });
  const orderIds = orders.map(({ id }) => id);
  const ingredientIds = Object.values(ids).filter(Boolean);
  await prisma.notification.deleteMany({ where: { referenceId: { in: [...orderIds, ...ingredientIds] } } });
  await prisma.inventoryMovement.deleteMany({ where: { ingredientId: { in: ingredientIds } } });
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.cashMovement.deleteMany({ where: { cashSessionId: sessionId } });
  await prisma.auditLog.deleteMany({ where: { userId: admin.id } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.cashSession.deleteMany({ where: { id: sessionId } });
  await prisma.cashRegister.deleteMany({ where: { id: registerId } });
  if (comboId) await prisma.combo.deleteMany({ where: { id: comboId } });
  if (productId) await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.ingredient.deleteMany({ where: { id: { in: ingredientIds } } });
  await prisma.user.deleteMany({ where: { id: admin.id } });
});

test("solo un producto que se vende frío y caliente acepta ingredientes por temperatura", { skip: !integrationEnabled }, async () => {
  await assert.rejects(
    ProductService.create({
      name: `RTEMP solo caliente ${tag}`, price: PRICE, cost: 10, categoryId, temperature: "HOT",
      recipe: { REGULAR: [{ ingredientId: ids.coffee, quantity: 12 }, { ingredientId: ids.ice, quantity: 160, temperature: "COLD" }] },
    }, admin),
    /fríos y calientes/,
  );
});

test("la venta fría descuenta vaso frío, hielo y su leche; la caliente, vaso caliente y su leche", { skip: !integrationEnabled }, async () => {
  const product = await ProductService.create({
    name: `RTEMP latte ${tag}`, price: PRICE, cost: 10, categoryId, temperature: "BOTH",
    recipe: {
      REGULAR: [
        { ingredientId: ids.coffee, quantity: 12 },
        { ingredientId: ids.milk, quantity: 300, temperature: "HOT" },
        { ingredientId: ids.hotCup, quantity: 1, temperature: "HOT" },
        { ingredientId: ids.milk, quantity: 250, temperature: "COLD" },
        { ingredientId: ids.coldCup, quantity: 1, temperature: "COLD" },
        { ingredientId: ids.ice, quantity: 160, temperature: "COLD" },
      ],
    },
  }, admin);
  productId = product.id;

  const before = { coffee: await stock(ids.coffee), milk: await stock(ids.milk), hotCup: await stock(ids.hotCup), coldCup: await stock(ids.coldCup), ice: await stock(ids.ice) };
  await sell("COLD");
  assert.deepEqual(
    [await stock(ids.coffee), await stock(ids.milk), await stock(ids.hotCup), await stock(ids.coldCup), await stock(ids.ice)],
    [before.coffee - 12, before.milk - 250, before.hotCup, before.coldCup - 1, before.ice - 160],
  );

  await sell("HOT");
  assert.deepEqual(
    [await stock(ids.coffee), await stock(ids.milk), await stock(ids.hotCup), await stock(ids.coldCup), await stock(ids.ice)],
    [before.coffee - 24, before.milk - 550, before.hotCup - 1, before.coldCup - 1, before.ice - 160],
  );

  // The API returns each line with its temperature.
  const detail = await ProductService.findOne(productId);
  const lines = (detail as unknown as { recipe: { REGULAR: { lines: { ingredientId: string; temperature?: string }[] } } }).recipe.REGULAR.lines;
  assert.equal(lines.filter((line) => line.temperature === "COLD").length, 3);
});

test("A3: un combo con la bebida fría descuenta vaso frío y hielo; sin elegir temperatura no se vende", { skip: !integrationEnabled }, async () => {
  assert.ok(productId, "depends on the previous test's product");
  comboId = (await prisma.combo.create({
    data: { name: `RTEMP combo ${tag}`, price: PRICE, isActive: true, activeOnDays: [], items: { create: [{ productId, quantity: 1 }] } },
  })).id;
  const sellCombo = (comboTemperatures?: { productId: string; temperature: "HOT" | "COLD" }[]) =>
    OrderService.create(
      { items: [{ comboId: comboId!, quantity: 1, ...(comboTemperatures && { comboTemperatures }) }], paymentMethod: "cash", cashReceived: PRICE, cashSessionId: sessionId },
      admin.id,
      `rtemp-${testId}-${++keyCounter}`,
    );

  await assert.rejects(sellCombo(), /Selecciona caliente o frío/);

  const before = { hotCup: await stock(ids.hotCup), coldCup: await stock(ids.coldCup), ice: await stock(ids.ice), milk: await stock(ids.milk) };
  const order = await sellCombo([{ productId, temperature: "COLD" }]);
  assert.deepEqual(
    [await stock(ids.hotCup), await stock(ids.coldCup), await stock(ids.ice), await stock(ids.milk)],
    [before.hotCup, before.coldCup - 1, before.ice - 160, before.milk - 250],
  );
  const line = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
  assert.equal(line.temperature, "COLD", "the board shows the drink as cold");
});
