import assert from "node:assert/strict";
import { test } from "node:test";
import { isSameIdempotentOrder } from "../src/utils/idempotentOrderMatch";

// F3 (estabilización 2026-11-14): a retry with the same idempotency key is accepted only for the
// same cart; a different cart under a reused key is rejected instead of returning the old sale.

const stored = {
  items: [
    { productId: "latte", size: "REGULAR", quantity: 1, sourceComboId: null, extras: [{ extraId: "shot" }] },
    // A 2x1 can split the same product into two stored lines.
    { productId: "latte", size: "REGULAR", quantity: 1, sourceComboId: null, extras: [{ extraId: "shot" }] },
    { productId: "bagel", size: "REGULAR", quantity: 1, sourceComboId: "desayuno", extras: [] },
    { productId: "cafe", size: "REGULAR", quantity: 1, sourceComboId: "desayuno", extras: [] },
  ],
  payments: [{ method: "cash" }],
};

const request = {
  items: [
    { productId: "latte", quantity: 2, extras: [{ extraId: "shot" }] },
    { comboId: "desayuno", quantity: 1 },
  ],
  paymentMethod: "cash",
};

test("el mismo carrito (reintento) coincide aunque la promoción haya partido la línea", () => {
  assert.equal(isSameIdempotentOrder(stored, request), true);
});

test("otro carrito con la misma clave no coincide", () => {
  assert.equal(isSameIdempotentOrder(stored, { ...request, items: [{ productId: "latte", quantity: 3, extras: [{ extraId: "shot" }] }, request.items[1]] }), false);
  assert.equal(isSameIdempotentOrder(stored, { ...request, items: [{ productId: "latte", quantity: 2, size: "JUMBO", extras: [{ extraId: "shot" }] }, request.items[1]] }), false);
  assert.equal(isSameIdempotentOrder(stored, { ...request, items: [{ productId: "latte", quantity: 2 }, request.items[1]] }), false);
  assert.equal(isSameIdempotentOrder(stored, { ...request, items: [request.items[0]] }), false);
  assert.equal(isSameIdempotentOrder(stored, { ...request, paymentMethod: "card" }), false);
});
