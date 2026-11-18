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

test("D-09: acepta compras grandes en unidad base (200 kg = 200,000 gr) y rechaza > 10,000,000", () => {
  const ok = createPurchaseSchema.safeParse({ items: [{ ingredientId, quantity: 200_000, unitCost: 0.028 }] });
  assert.equal(ok.success, true);
  const tooBig = createPurchaseSchema.safeParse({ items: [{ ingredientId, quantity: 10_000_001, unitCost: 0 }] });
  assert.equal(tooBig.success, false);
  // Line total cap keeps Decimal(14,2) / Decimal(12,2) safe.
  const overflow = createPurchaseSchema.safeParse({ items: [{ ingredientId, quantity: 10_000_000, unitCost: 1_000_000 }] });
  assert.equal(overflow.success, false);
});

test("D-03: normaliza números con espacios y rechaza vacíos, hex, exponentes y comas", () => {
  const parsed = createPurchaseSchema.parse({ items: [{ ingredientId, quantity: " 2 ", unitCost: "10.5" }] });
  assert.deepEqual(parsed.items[0], { ingredientId, quantity: "2", unitCost: "10.5" });
  const fromFloat = createPurchaseSchema.parse({ items: [{ ingredientId, quantity: 1100.0000000000002, unitCost: 1e-7 }] });
  assert.equal(fromFloat.items[0].unitCost, "0.0000001");
  for (const bad of ["", "  ", "0x10", "1e3", "1,5", "abc"]) {
    assert.equal(createPurchaseSchema.safeParse({ items: [{ ingredientId, quantity: bad, unitCost: 1 }] }).success, false, `quantity=${JSON.stringify(bad)}`);
    assert.equal(createPurchaseSchema.safeParse({ items: [{ ingredientId, quantity: 1, unitCost: bad }] }).success, false, `unitCost=${JSON.stringify(bad)}`);
  }
});

test("updatePurchaseSchema aplica las mismas reglas de signo", () => {
  const result = updatePurchaseSchema.safeParse({
    items: [{ ingredientId, quantity: -2, unitCost: 10 }],
  });
  assert.equal(result.success, false);
});
