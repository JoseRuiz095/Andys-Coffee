import assert from "node:assert/strict";
import { test } from "node:test";
import { nextIngredientSku } from "../src/services/inventory.service";

test("SKU de insumo: INS-### siguiente al mayor en uso, ignorando otros formatos", () => {
  assert.equal(nextIngredientSku([]), "INS-001");
  assert.equal(nextIngredientSku(["INS-001", "INS-009", "PROD-051", "INS-abc"]), "INS-010");
  assert.equal(nextIngredientSku(["INS-999"]), "INS-1000");
});
