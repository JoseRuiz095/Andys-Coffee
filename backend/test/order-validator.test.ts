import assert from "node:assert/strict";
import { test } from "node:test";
import { createOrderSchema } from "../src/validators/order.validator";

const validBase = { quantity: 1, paymentMethod: "card" as const, items: [] };

test("un pedido exige exactamente producto o combo por línea", () => {
  const productId = "00000000-0000-0000-0000-000000000001";
  const comboId = "00000000-0000-0000-0000-000000000002";

  for (const item of [{ quantity: 1 }, { quantity: 1, productId, comboId }]) {
    const result = createOrderSchema.safeParse({ ...validBase, items: [item] });
    assert.equal(result.success, false);
  }
});

test("el validador limita cantidades y extras", () => {
  const result = createOrderSchema.safeParse({
    ...validBase,
    items: [{
      productId: "00000000-0000-0000-0000-000000000001",
      quantity: 100,
      extras: [{ extraId: "00000000-0000-0000-0000-000000000002", quantity: 21 }],
    }],
  });

  assert.equal(result.success, false);
});

test("el método de pago inválido y el pedido vacío se rechazan", () => {
  assert.equal(createOrderSchema.safeParse({ ...validBase, paymentMethod: "bitcoin" }).success, false);
  assert.equal(createOrderSchema.safeParse({ ...validBase, items: [] }).success, false);
});