import assert from "node:assert/strict";
import { test } from "node:test";
import { createPurchaseSchema, updatePurchaseSchema } from "../src/validators/purchase.validator";

const ingredientId = "00000000-0000-4000-8000-000000000001";

test("createPurchaseSchema rechaza cantidad negativa o cero", () => {
  for (const quantity of [-1, 0, "-5", "0"]) {
    const result = createPurchaseSchema.safeParse({
      items: [{ ingredientId, quantity, unitCost: 10 }],
    });
    assert.equal(result.success, false);
  }
});

test("createPurchaseSchema rechaza costo unitario negativo", () => {
  for (const unitCost of [-1, "-0.01"]) {
    const result = createPurchaseSchema.safeParse({
      items: [{ ingredientId, quantity: 5, unitCost }],
    });
    assert.equal(result.success, false);
  }
});

test("createPurchaseSchema acepta costo unitario en 0 pero exige cantidad positiva", () => {
  assert.equal(
    createPurchaseSchema.safeParse({ items: [{ ingredientId, quantity: 5, unitCost: 0 }] }).success,
    true,
  );
  assert.equal(
    createPurchaseSchema.safeParse({ items: [{ ingredientId, quantity: 0, unitCost: 5 }] }).success,
    false,
  );
});

test("createPurchaseSchema no acepta tax del cliente (el servicio siempre lo fija en 0)", () => {
  const result = createPurchaseSchema.safeParse({
    items: [{ ingredientId, quantity: 5, unitCost: 10 }],
    tax: -1,
  });
  assert.equal(result.success, true);
  assert.equal("tax" in (result.data ?? {}), false);
});

test("updatePurchaseSchema aplica las mismas reglas de signo", () => {
  const result = updatePurchaseSchema.safeParse({
    items: [{ ingredientId, quantity: -2, unitCost: 10 }],
  });
  assert.equal(result.success, false);
});
