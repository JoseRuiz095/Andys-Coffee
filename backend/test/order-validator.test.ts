import assert from "node:assert/strict";
import { test } from "node:test";
import { createOrderSchema } from "../src/validators/order.validator";

const validBase = { paymentMethod: "card" as const, items: [] };

test("un pedido exige exactamente producto o combo por línea", () => {
  const productId = "00000000-0000-4000-8000-000000000001";
  const comboId = "00000000-0000-4000-8000-000000000002";

  for (const item of [{ quantity: 1 }, { quantity: 1, productId, comboId }]) {
    const result = createOrderSchema.safeParse({ ...validBase, items: [item] });
    assert.equal(result.success, false);
  }
});

test("el validador limita cantidades y extras", () => {
  const result = createOrderSchema.safeParse({
    ...validBase,
    items: [{
      productId: "00000000-0000-4000-8000-000000000001",
      quantity: 100,
      extras: [{ extraId: "00000000-0000-4000-8000-000000000002", quantity: 21 }],
    }],
  });

  assert.equal(result.success, false);
});

test("el método de pago inválido y el pedido vacío se rechazan", () => {
  assert.equal(createOrderSchema.safeParse({ ...validBase, paymentMethod: "bitcoin" }).success, false);
  assert.equal(createOrderSchema.safeParse({ ...validBase, items: [] }).success, false);
});

test("rechaza campos desconocidos y extras en combos", () => {
  const comboId = "00000000-0000-4000-8000-000000000002";
  const extraId = "00000000-0000-4000-8000-000000000003";

  assert.equal(createOrderSchema.safeParse({
    ...validBase,
    items: [{ comboId, quantity: 1, unexpected: true }],
  }).success, false);
  assert.equal(createOrderSchema.safeParse({
    ...validBase,
    items: [{ comboId, quantity: 1, extras: [{ extraId, quantity: 1 }] }],
  }).success, false);
});

test("normaliza las variantes permitidas del método de pago", () => {
  const result = createOrderSchema.safeParse({
    ...validBase,
    paymentMethod: "Efectivo",
    items: [{
      productId: "00000000-0000-4000-8000-000000000001",
      quantity: 1,
    }],
  });

  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.paymentMethod, "cash");
});

test("acepta una fecha programada futura y rechaza una fecha pasada", () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 60 * 1000).toISOString();

  assert.equal(createOrderSchema.safeParse({
    ...validBase,
    scheduledFor: future,
    items: [{
      productId: "00000000-0000-4000-8000-000000000001",
      quantity: 1,
    }],
  }).success, true);

  assert.equal(createOrderSchema.safeParse({
    ...validBase,
    scheduledFor: past,
    items: [{
      productId: "00000000-0000-4000-8000-000000000001",
      quantity: 1,
    }],
  }).success, false);
});

test('la temperatura de una venta debe ser concreta y no aplica a combos', () => {
  const productId = "00000000-0000-4000-8000-000000000001";
  const comboId = "00000000-0000-4000-8000-000000000002";

  for (const temperature of ['HOT', 'COLD']) {
    assert.equal(createOrderSchema.safeParse({
      ...validBase,
      items: [{ productId, quantity: 1, temperature }],
    }).success, true);
  }

  assert.equal(createOrderSchema.safeParse({
    ...validBase,
    items: [{ productId, quantity: 1, temperature: 'BOTH' }],
  }).success, false);
  assert.equal(createOrderSchema.safeParse({
    ...validBase,
    items: [{ comboId, quantity: 1, temperature: 'HOT' }],
  }).success, false);
});

test('Jumbo es un tamaño de producto válido y no puede agregarse a combos', () => {
  const productId = "00000000-0000-4000-8000-000000000001";
  const comboId = "00000000-0000-4000-8000-000000000002";

  assert.equal(createOrderSchema.safeParse({
    ...validBase,
    items: [{ productId, quantity: 1, size: 'JUMBO' }],
  }).success, true);
  assert.equal(createOrderSchema.safeParse({
    ...validBase,
    items: [{ productId, quantity: 1, size: 'LARGE' }],
  }).success, false);
  assert.equal(createOrderSchema.safeParse({
    ...validBase,
    items: [{ comboId, quantity: 1, size: 'JUMBO' }],
  }).success, false);
});