import assert from "node:assert/strict";
import { test } from "node:test";
import { suggestReplenishment } from "../src/services/replenishment.service";

test("C-26: bajo el mínimo se sugiere llegar al máximo, con consumo y cobertura del periodo", () => {
  const result = suggestReplenishment({ current: 2, minimum: 5, maximum: 20, consumed: 42, days: 14 });
  assert.equal(result.dailyConsumption, 3);
  assert.equal(result.coverageDays, 0.7);
  assert.equal(result.needed, true);
  assert.equal(result.suggestedQuantity, 18, "up to the maximum, never above it");
});

test("sin máximo el objetivo es 2 × mínimo; sin consumo y sobre el mínimo no se sugiere", () => {
  assert.equal(suggestReplenishment({ current: 4, minimum: 10, maximum: null, consumed: 0, days: 14 }).suggestedQuantity, 16);
  const healthy = suggestReplenishment({ current: 50, minimum: 10, maximum: null, consumed: 0, days: 14 });
  assert.equal(healthy.needed, false);
  assert.equal(healthy.coverageDays, null);
});

test("sobre el mínimo pero con poca cobertura: se compra una semana de consumo (tope: el máximo)", () => {
  // 30 in stock, 14/day → 2.1 days of coverage; target (2 × 10) already met → 7 × 14 − 30 = 68.
  const result = suggestReplenishment({ current: 30, minimum: 10, maximum: null, consumed: 196, days: 14 });
  assert.equal(result.needed, true);
  assert.equal(result.suggestedQuantity, 68);
  assert.equal(suggestReplenishment({ current: 30, minimum: 10, maximum: 50, consumed: 196, days: 14 }).suggestedQuantity, 20);
});

test("stock negativo (D-1): se sugiere reponer lo faltante más el objetivo", () => {
  const result = suggestReplenishment({ current: -8, minimum: 50, maximum: 500, consumed: 280, days: 14 });
  assert.equal(result.coverageDays, 0);
  assert.equal(result.suggestedQuantity, 508);
});
