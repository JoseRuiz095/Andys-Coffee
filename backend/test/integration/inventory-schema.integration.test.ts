import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Prisma } from "@prisma/client";
import { prisma } from "../../src/config/prisma";

// Database rules added by migration 20261111120000_inventory_realtime_catalog (plan F1):
// negative stock allowed (D-1), maximum >= minimum, known movement types, recipes per size,
// one sale movement per order line and ingredient, unit factors and the recipes permission.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();
const short = testId.slice(0, 8);

let unitId: string;
let ingredientId: string;
let productId: string;
let extraId: string;
let orderId: string;
let orderItemId: string;
const familyIds: string[] = [];

/** Runs a statement that must be rejected by a CHECK/unique constraint. */
async function rejects(work: () => Promise<unknown>, pattern: RegExp) {
  await assert.rejects(work, (error: unknown) => {
    assert.match(String(error instanceof Error ? error.message : error), pattern);
    return true;
  });
}

before(async () => {
  if (!integrationEnabled) return;

  const unit = await prisma.inventoryUnit.create({
    data: { name: `schema-unit-${testId}`, abbreviation: `s${short}`, dimension: "MASS", factor: 1 },
  });
  unitId = unit.id;
  const ingredient = await prisma.ingredient.create({
    data: { name: `schema-ingredient-${testId}`, unitId, currentStock: 5, minimumStock: 2 },
  });
  ingredientId = ingredient.id;
  const product = await prisma.product.create({
    data: { name: `schema-product-${testId}`, sku: `SCH-${testId}`, price: 50 },
  });
  productId = product.id;
  const extra = await prisma.extra.create({ data: { name: `schema-extra-${testId}`, price: 0 } });
  extraId = extra.id;
  const order = await prisma.order.create({ data: {} });
  orderId = order.id;
  const orderItem = await prisma.orderItem.create({
    data: { orderId, productId, productName: product.name, quantity: 1, unitPrice: 50, subtotal: 50 },
  });
  orderItemId = orderItem.id;
});

after(async () => {
  if (!integrationEnabled) return;

  await prisma.inventoryMovement.deleteMany({ where: { ingredientId } });
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.deleteMany({ where: { id: orderId } });
  await prisma.recipe.deleteMany({ where: { productId } });
  await prisma.extraRecipe.deleteMany({ where: { extraId } });
  await prisma.extra.deleteMany({ where: { id: extraId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.productFamily.deleteMany({ where: { id: { in: familyIds } } });
  await prisma.ingredient.deleteMany({ where: { id: ingredientId } });
  await prisma.inventoryUnit.deleteMany({ where: { id: unitId } });
});

test("D-1: el stock de un insumo puede quedar negativo; mínimo y costo siguen sin negativos", { skip: !integrationEnabled }, async () => {
  const updated = await prisma.ingredient.update({
    where: { id: ingredientId },
    data: { currentStock: { decrement: 8 } },
  });
  assert.equal(updated.currentStock.toNumber(), -3);

  await rejects(
    () => prisma.ingredient.update({ where: { id: ingredientId }, data: { minimumStock: -1 } }),
    /ingredients_stock_nonnegative_check/,
  );
  await rejects(
    () => prisma.ingredient.update({ where: { id: ingredientId }, data: { averageCost: -1 } }),
    /ingredients_stock_nonnegative_check/,
  );
});

test("stock máximo: opcional, pero nunca menor que el mínimo", { skip: !integrationEnabled }, async () => {
  const withMax = await prisma.ingredient.update({ where: { id: ingredientId }, data: { maximumStock: 10 } });
  assert.equal(withMax.maximumStock?.toNumber(), 10);

  await rejects(
    () => prisma.ingredient.update({ where: { id: ingredientId }, data: { maximumStock: 1 } }),
    /ingredients_maximum_stock_check/,
  );
  await prisma.ingredient.update({ where: { id: ingredientId }, data: { maximumStock: null } });
});

test("movimientos: sólo tipos conocidos y un único 'sale' por línea de pedido e insumo", { skip: !integrationEnabled }, async () => {
  await rejects(
    () => prisma.inventoryMovement.create({ data: { ingredientId, type: "loquesea", quantity: 1 } }),
    /inventory_movements_type_check/,
  );

  const sale = await prisma.inventoryMovement.create({
    data: {
      ingredientId, type: "sale", quantity: -1, referenceType: "order", referenceId: orderId,
      orderItemId, balanceAfter: new Prisma.Decimal(-4),
    },
  });
  assert.equal(sale.balanceAfter?.toNumber(), -4);
  assert.equal(sale.orderItemId, orderItemId);

  await rejects(
    () => prisma.inventoryMovement.create({
      data: { ingredientId, type: "sale", quantity: -1, referenceType: "order", referenceId: orderId, orderItemId },
    }),
    /Unique constraint|inventoryMovements_sale_once/,
  );

  // One reversal is fine; a second one is not.
  await prisma.inventoryMovement.create({
    data: { ingredientId, type: "sale_reversal", quantity: 1, referenceType: "order_cancellation", referenceId: orderId, orderItemId },
  });
  await rejects(
    () => prisma.inventoryMovement.create({
      data: { ingredientId, type: "sale_reversal", quantity: 1, referenceType: "order_cancellation", referenceId: orderId, orderItemId },
    }),
    /Unique constraint|inventoryMovements_sale_reversal_once/,
  );

  // Movements without an order line (legacy sales, purchases...) are not limited.
  await prisma.inventoryMovement.createMany({
    data: [
      { ingredientId, type: "sale", quantity: -1, referenceType: "order", referenceId: orderId },
      { ingredientId, type: "sale", quantity: -1, referenceType: "order", referenceId: orderId },
    ],
  });
});

test("recetas: una por tamaño, cantidad positiva; los extras pueden restar pero no valer cero", { skip: !integrationEnabled }, async () => {
  await prisma.recipe.createMany({
    data: [
      { productId, ingredientId, quantity: 18 },
      { productId, ingredientId, size: "JUMBO", quantity: 27 },
    ],
  });
  const sizes = (await prisma.recipe.findMany({ where: { productId }, select: { size: true } })).map(({ size }) => size).sort();
  assert.deepEqual(sizes, ["JUMBO", "REGULAR"]);

  await rejects(
    () => prisma.recipe.create({ data: { productId, ingredientId, size: "JUMBO", quantity: 30 } }),
    /Unique constraint|recipes_unique/,
  );
  await prisma.recipe.deleteMany({ where: { productId, size: "JUMBO" } });
  await rejects(
    () => prisma.recipe.create({ data: { productId, ingredientId, size: "JUMBO", quantity: 0 } }),
    /recipes_quantity_positive_check/,
  );

  const subtraction = await prisma.extraRecipe.create({ data: { extraId, ingredientId, quantity: -10 } });
  assert.equal(subtraction.quantity.toNumber(), -10);
  await prisma.extraRecipe.delete({ where: { id: subtraction.id } });
  await rejects(
    () => prisma.extraRecipe.create({ data: { extraId, ingredientId, quantity: 0 } }),
    /extra_recipes_quantity_nonzero_check/,
  );
});

test("familias: nombre único sin importar mayúsculas ni espacios; un producto guarda familia, variante y opciones", { skip: !integrationEnabled }, async () => {
  const family = await prisma.productFamily.create({ data: { name: `Familia ${testId}` } });
  familyIds.push(family.id);
  await rejects(
    () => prisma.productFamily.create({ data: { name: `  familia ${testId.toUpperCase()} ` } }),
    /Unique constraint|productFamilies_name_normalized_unique/,
  );

  await prisma.product.update({
    where: { id: productId },
    data: {
      familyId: family.id,
      variantLabel: "Pollo · Rojos",
      tracksInventory: true,
      options: { create: [{ name: "Salsa", value: "Roja" }, { name: "Proteína", value: "Pollo" }] },
    },
  });
  const stored = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: { options: true } });
  assert.equal(stored.familyId, family.id);
  assert.equal(stored.options.length, 2);

  // Deleting the family leaves the product without one instead of failing.
  await prisma.productFamily.delete({ where: { id: family.id } });
  const orphan = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  assert.equal(orphan.familyId, null);
});

test("unidades sembradas con dimensión y factor; permiso de recetas sólo para ADMIN; preferencias apagadas", { skip: !integrationEnabled }, async () => {
  const units = await prisma.inventoryUnit.findMany({ where: { abbreviation: { in: ["gr", "kg", "ml", "lt", "pz"] } } });
  const byAbbreviation = Object.fromEntries(units.map((u) => [u.abbreviation, `${u.dimension}:${u.factor.toNumber()}`]));
  assert.deepEqual(byAbbreviation, { gr: "MASS:1", kg: "MASS:1000", ml: "VOLUME:1", lt: "VOLUME:1000", pz: "COUNT:1" });

  await rejects(
    () => prisma.inventoryUnit.update({ where: { id: unitId }, data: { factor: 0 } }),
    /inventory_units_factor_positive_check/,
  );

  const holders = await prisma.rolePermission.findMany({
    where: { permission: { name: "inventory.manage_recipes" } },
    select: { role: { select: { name: true } } },
  });
  const roles = holders.map(({ role }) => role.name);
  assert.ok(roles.includes("ADMIN"));
  assert.ok(!roles.includes("CAJERO"));

  const consume = await prisma.systemPreference.findUniqueOrThrow({ where: { key: "inventory.consumeOnSale" } });
  assert.equal(consume.value, "false");
});
