import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import type { AuthUser } from "../../src/services/auth.service";
import { InventorySettingsService } from "../../src/services/inventory-settings.service";
import { OrderService } from "../../src/services/order.service";
import { ReplenishmentService } from "../../src/services/replenishment.service";

// Plan F5/F6: with inventory.consumeOnSale on, a sale consumes its recipes in the same
// transaction (stock may go negative), each line leaves traceable movements, a cancellation
// gives the ingredients back (or records waste once prepared) only once, and ingredients that
// cross their minimum raise one LOW_STOCK notification.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();
const tag = testId.slice(0, 8);

let admin: AuthUser;
let categoryId: string;
let coffeeId: string;
let cupId: string;
let productId: string;
let extraId: string;
let registerId: string;
let sessionId: string;
let previousConsume: string | null = null;
const PRICE = 60;
const JUMBO_PRICE = 90;
const SHOT_PRICE = 15;

const stock = async (id: string) => (await prisma.ingredient.findUniqueOrThrow({ where: { id } })).currentStock.toNumber();
let keyCounter = 0;
const sell = (items: Parameters<typeof OrderService.create>[0]["items"], total: number) =>
  OrderService.create({ items, paymentMethod: "cash", cashReceived: total, cashSessionId: sessionId }, admin.id, `rt-${testId}-${++keyCounter}`);

before(async () => {
  if (!integrationEnabled) return;
  const gram = await prisma.inventoryUnit.findFirstOrThrow({ where: { abbreviation: "gr" } });
  const piece = await prisma.inventoryUnit.findFirstOrThrow({ where: { abbreviation: "pz" } });
  coffeeId = (await prisma.ingredient.create({
    data: { name: `RT café ${tag}`, sku: `RT-CAF-${tag}`, unitId: gram.id, currentStock: 100, minimumStock: 50, averageCost: 0.5 },
  })).id;
  cupId = (await prisma.ingredient.create({
    data: { name: `RT vaso ${tag}`, sku: `RT-VAS-${tag}`, unitId: piece.id, currentStock: 10, minimumStock: 2, averageCost: 1.5 },
  })).id;
  categoryId = (await prisma.category.create({ data: { name: `RT bebidas ${tag}`, isBeverage: true } })).id;
  productId = (await prisma.product.create({
    data: {
      name: `RT latte ${tag}`, sku: `RT-LAT-${tag}`, price: PRICE, jumboPrice: JUMBO_PRICE, cost: 10, categoryId, temperature: "HOT",
      recipes: {
        create: [
          { size: "REGULAR", ingredientId: coffeeId, quantity: 18 },
          { size: "REGULAR", ingredientId: cupId, quantity: 1 },
          { size: "JUMBO", ingredientId: coffeeId, quantity: 27 },
          { size: "JUMBO", ingredientId: cupId, quantity: 1 },
        ],
      },
    },
  })).id;
  extraId = (await prisma.extra.create({
    data: { name: `RT shot ${tag}`, price: SHOT_PRICE, recipes: { create: [{ ingredientId: coffeeId, quantity: 9 }] } },
  })).id;
  await prisma.productExtra.create({ data: { productId, extraId } });

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" }, include: { permissions: { include: { permission: true } } } });
  const user = await prisma.user.create({
    data: { email: `rt-${testId}@test.local`, name: "RT Admin", passwordHash: "unused", roleId: adminRole.id },
  });
  admin = {
    id: user.id, name: user.name, email: user.email, roleId: adminRole.id, roleName: "ADMIN", isActive: true,
    permissions: adminRole.permissions.map(({ permission }) => permission.name),
  };
  registerId = (await prisma.cashRegister.create({ data: { name: `rt-register-${testId}` } })).id;
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
  await prisma.notification.deleteMany({ where: { referenceId: { in: [...orderIds, coffeeId, cupId] } } });
  await prisma.inventoryMovement.deleteMany({ where: { ingredientId: { in: [coffeeId, cupId] } } });
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.cashMovement.deleteMany({ where: { cashSessionId: sessionId } });
  await prisma.auditLog.deleteMany({ where: { userId: admin.id } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.cashSession.deleteMany({ where: { id: sessionId } });
  await prisma.cashRegister.deleteMany({ where: { id: registerId } });
  await prisma.productExtra.deleteMany({ where: { productId } });
  await prisma.extra.deleteMany({ where: { id: extraId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.ingredient.deleteMany({ where: { id: { in: [coffeeId, cupId] } } });
  await prisma.user.deleteMany({ where: { id: admin.id } });
});

test("C-06/C-27: la venta descuenta recetas por tamaño y extras, deja movimientos trazables y avisa una vez", { skip: !integrationEnabled }, async () => {
  const order = await sell([
    { productId, quantity: 1, temperature: "HOT", extras: [{ extraId, quantity: 1 }] },
    { productId, quantity: 1, size: "JUMBO", temperature: "HOT" },
  ], PRICE + SHOT_PRICE + JUMBO_PRICE);

  // 18 + 9 (shot) + 27 (Jumbo) = 54 g of coffee; 2 cups.
  assert.equal(await stock(coffeeId), 46);
  assert.equal(await stock(cupId), 8);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).inventoryProcessed, true);

  const movements = await prisma.inventoryMovement.findMany({
    where: { referenceType: "order", referenceId: order.id },
    include: { orderItem: { select: { size: true } } },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(movements.length, 4, "one movement per line and ingredient");
  assert.ok(movements.every((m) => m.type === "sale" && m.createdById === admin.id && m.orderItemId && m.balanceAfter !== null));
  const coffee = movements.filter((m) => m.ingredientId === coffeeId);
  assert.deepEqual(coffee.map((m) => [m.orderItem?.size, m.quantity.toNumber()]).sort(), [["JUMBO", -27], ["REGULAR", -27]].sort());
  assert.deepEqual(coffee.map((m) => m.balanceAfter?.toNumber()).sort(), [46, 73], "balances walk down from 100");

  // Coffee crossed its minimum (100 → 46, minimum 50): one alert; the next sale doesn't repeat it.
  const alerts = () => prisma.notification.count({ where: { type: "LOW_STOCK", referenceId: coffeeId } });
  assert.equal(await alerts(), 1);
  await sell([{ productId, quantity: 1, temperature: "HOT" }], PRICE);
  assert.equal(await alerts(), 1);
  assert.equal(await stock(coffeeId), 28);
});

test("C-07: reenviar la misma venta (idempotencia) no vuelve a descontar", { skip: !integrationEnabled }, async () => {
  const key = `rt-${testId}-replay`;
  const payload = { items: [{ productId, quantity: 1, temperature: "HOT" as const }], paymentMethod: "cash" as const, cashReceived: PRICE, cashSessionId: sessionId };
  const before = await stock(coffeeId);
  const first = await OrderService.create(payload, admin.id, key);
  const second = await OrderService.create(payload, admin.id, key);
  assert.equal(first.id, second.id);
  assert.equal(await stock(coffeeId), before - 18);
  assert.equal(await prisma.inventoryMovement.count({ where: { referenceId: first.id, type: "sale" } }), 2);
});

test("C-08: sin existencias suficientes la venta se registra y el stock queda negativo", { skip: !integrationEnabled }, async () => {
  const cupsBefore = await stock(cupId);
  const order = await sell([{ productId, quantity: cupsBefore + 3, temperature: "HOT" }], PRICE * (cupsBefore + 3));
  assert.ok(order.id);
  assert.equal(await stock(cupId), -3);
  assert.ok(await prisma.notification.count({ where: { type: "LOW_STOCK", referenceId: cupId } }) >= 1);
});

test("C-10/C-12: cancelar un pedido pendiente devuelve los insumos una sola vez", { skip: !integrationEnabled }, async () => {
  const before = await stock(coffeeId);
  const order = await sell([{ productId, quantity: 2, temperature: "HOT" }], PRICE * 2);
  assert.equal(await stock(coffeeId), before - 36);

  const results = await Promise.allSettled([
    OrderService.updateStatus(order.id, { status: "cancelled", reason: "Prueba" }, admin),
    OrderService.updateStatus(order.id, { status: "cancelled", reason: "Prueba" }, admin),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, JSON.stringify(results.map((r) => r.status)));
  assert.equal(await stock(coffeeId), before, "ingredients back");
  const reversals = await prisma.inventoryMovement.findMany({ where: { referenceId: order.id, type: "sale_reversal" } });
  assert.equal(reversals.length, 2);
  assert.ok(reversals.every((m) => m.orderItemId && m.balanceAfter !== null));
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).inventoryProcessed, false);
});

test("C-11/C-16: cancelar ya preparado registra reversa + merma (stock igual), según los movimientos originales", { skip: !integrationEnabled }, async () => {
  const order = await sell([{ productId, quantity: 1, temperature: "HOT" }], PRICE);
  const afterSale = await stock(coffeeId);
  // The recipe changes after the sale: the cancellation still uses what the sale consumed.
  await prisma.recipe.updateMany({ where: { productId, ingredientId: coffeeId, size: "REGULAR" }, data: { quantity: 30 } });

  await OrderService.updateStatus(order.id, { status: "preparing" }, admin);
  await OrderService.updateStatus(order.id, { status: "cancelled", reason: "Cliente se fue" }, admin);

  assert.equal(await stock(coffeeId), afterSale, "the prepared drink's ingredients are not returned");
  const movements = await prisma.inventoryMovement.findMany({ where: { referenceId: order.id, ingredientId: coffeeId } });
  const byType = Object.fromEntries(movements.map((m) => [`${m.type}:${m.reason ?? ""}`, m.quantity.toNumber()]));
  assert.deepEqual(byType, { "sale:": -18, "sale_reversal:": 18, "exit:waste": -18 });
  await prisma.recipe.updateMany({ where: { productId, ingredientId: coffeeId, size: "REGULAR" }, data: { quantity: 18 } });
});

test("C-09: ventas simultáneas del mismo producto descuentan exactamente lo vendido", { skip: !integrationEnabled }, async () => {
  const before = await stock(coffeeId);
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, () => sell([{ productId, quantity: 1, temperature: "HOT" }], PRICE)),
  );
  const sold = results.filter((r) => r.status === "fulfilled").length;
  const failures = results.flatMap((r) => (r.status === "rejected" ? [String((r.reason as Error).message)] : []));
  assert.ok(sold >= 1, JSON.stringify(failures));
  // Only serialization conflicts may fail (they surface as 409 and the POS retries).
  assert.ok(failures.every((message) => /serializ|concurren|could not serialize|P2034|write conflict/i.test(message)), JSON.stringify(failures));
  assert.equal(await stock(coffeeId), before - 18 * sold);
});

test("C-25: no se puede activar el descuento mientras haya productos sin receta", { skip: !integrationEnabled }, async () => {
  await prisma.systemPreference.update({ where: { key: "inventory.consumeOnSale" }, data: { value: "false" } });
  try {
    // The seeded sample catalog has products without recipes.
    await assert.rejects(
      InventorySettingsService.update({ consumeOnSale: true }, admin),
      (error: Error) => error.name === "ConflictError" && /sin receta/.test(error.message),
    );
    const cashier = { ...admin, permissions: ["inventory.view"] };
    await assert.rejects(InventorySettingsService.update({ lowStockNotify: false }, cashier), { name: "AuthorizationError" });
    assert.deepEqual(await InventorySettingsService.get(), { consumeOnSale: false, lowStockNotify: true });
  } finally {
    await prisma.systemPreference.update({ where: { key: "inventory.consumeOnSale" }, data: { value: "true" } });
  }
});

test("C-26 (integración): las sugerencias usan el consumo real y ordenan por urgencia", { skip: !integrationEnabled }, async () => {
  const suggestions = await ReplenishmentService.getSuggestions(14, admin);
  const cup = suggestions.find((row) => row.ingredientId === cupId);
  assert.ok(cup, "the cup ran out (negative stock) and is suggested");
  assert.ok(cup!.dailyConsumption > 0);
  assert.equal(cup!.coverageDays, 0);
  // No maximum: target = 2 × minimum (4); stock is negative, so buy the missing part too.
  assert.equal(cup!.suggestedQuantity, 4 - cup!.currentStock);
  assert.equal(cup!.lastSupplier, null, "never purchased");
  const coffee = suggestions.find((row) => row.ingredientId === coffeeId);
  assert.ok(coffee, "coffee is below its minimum");
  // Most urgent first: coverage never decreases along the list (no coverage data goes last).
  const coverage = suggestions.map((row) => row.coverageDays ?? Infinity);
  assert.deepEqual(coverage, [...coverage].sort((a, b) => a - b));
});
