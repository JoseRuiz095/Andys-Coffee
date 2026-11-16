import assert from "node:assert/strict";
import { test } from "node:test";
import { createProductSchema } from "../src/validators/product.validator";
import { createPurchaseSchema } from "../src/validators/purchase.validator";
import { inventoryExitSchema } from "../src/validators/inventory.validator";
import { accumulatedBalancesSchema } from "../src/validators/income-statement.validator";
import { orderItemExtraSchema } from "../src/validators/order.validator";
import { categoryListQuerySchema } from "../src/validators/category.validator";

// V1–V4, F7 and R3 (estabilización 2026-11-14): values that used to reach the database and
// answer 500 (Decimal overflow, NaN, Infinity, negative offsets) are rejected as validation errors.

const uuid = "0f8fad5b-d9cb-469f-a165-70867728950e";

test("V1: precio y costo de producto finitos y acotados", () => {
  const base = { name: "Latte", price: 50, cost: 10 };
  assert.equal(createProductSchema.safeParse(base).success, true);
  assert.equal(createProductSchema.safeParse({ ...base, price: "Infinity" }).success, false);
  assert.equal(createProductSchema.safeParse({ ...base, price: 1e13 }).success, false);
  assert.equal(createProductSchema.safeParse({ ...base, name: "x".repeat(121) }).success, false);
});

test("V2: la cantidad de una salida debe ser un número positivo", () => {
  const base = { ingredientId: uuid, reason: "waste" };
  assert.equal(inventoryExitSchema.safeParse({ ...base, quantity: "2.5" }).success, true);
  for (const quantity of ["abc", "", "0", "-1", "1e9"]) {
    assert.equal(inventoryExitSchema.safeParse({ ...base, quantity }).success, false, quantity);
  }
});

test("V3: cantidades y costos de compra acotados (el total cabe en la columna)", () => {
  const item = (quantity: string, unitCost: string) => ({ items: [{ ingredientId: uuid, quantity, unitCost }] });
  assert.equal(createPurchaseSchema.safeParse(item("10", "25.5")).success, true);
  assert.equal(createPurchaseSchema.safeParse(item("1e12", "1")).success, false);
  assert.equal(createPurchaseSchema.safeParse(item("1", "1e12")).success, false);
  assert.equal(createPurchaseSchema.safeParse({ ...item("1", "1"), notes: "x".repeat(1001) }).success, false);
});

test("V4: saldos acumulados acotados", () => {
  const ok = { ahorroAcumulado: 100, fondoNegocioAcumulado: 50, surtidoAcumulado: 25 };
  assert.equal(accumulatedBalancesSchema.safeParse(ok).success, true);
  assert.equal(accumulatedBalancesSchema.safeParse({ ...ok, ahorroAcumulado: 1e12 }).success, false);
});

test("F7: los extras se piden en unidades enteras", () => {
  assert.equal(orderItemExtraSchema.safeParse({ extraId: uuid, quantity: 2 }).success, true);
  assert.equal(orderItemExtraSchema.safeParse({ extraId: uuid, quantity: 0.5 }).success, false);
});

test("R3: la lista pública de categorías valida la paginación", () => {
  assert.deepEqual(categoryListQuerySchema.parse({}), { page: 1, limit: 100 });
  assert.equal(categoryListQuerySchema.safeParse({ page: "-1" }).success, false);
  assert.equal(categoryListQuerySchema.safeParse({ limit: "1000" }).success, false);
  assert.equal(categoryListQuerySchema.parse({ includeInactive: "false" }).includeInactive, false);
});
