import assert from "node:assert/strict";
import { test } from "node:test";
import { assertProductRecipeRules } from "../src/services/recipe.service";
import { extraRecipeSchema, productRecipeSchema } from "../src/validators/recipe.validator";
import { createProductSchema } from "../src/validators/product.validator";

const rules = (overrides: Partial<Parameters<typeof assertProductRecipeRules>[0]>) => () =>
  assertProductRecipeRules({ tracksInventory: true, isActive: true, jumboAvailable: false, regularLines: 1, jumboLines: 0, ...overrides });

test("D-5: receta obligatoria salvo 'No controla inventario'; Jumbo sólo si el producto lo vende", () => {
  assert.doesNotThrow(rules({}));
  assert.throws(rules({ regularLines: 0 }), /Captura la receta/);
  assert.doesNotThrow(rules({ regularLines: 0, tracksInventory: false }));
  assert.doesNotThrow(rules({ regularLines: 0, isActive: false }), "an inactive product may lack a recipe");
  assert.throws(rules({ jumboAvailable: true }), /receta Jumbo/);
  assert.doesNotThrow(rules({ jumboAvailable: true, jumboLines: 2 }));
  assert.throws(rules({ jumboLines: 1 }), /Sólo las bebidas con precio Jumbo/);
  assert.throws(rules({ jumboLines: 1, tracksInventory: false }), /Sólo las bebidas con precio Jumbo/);
});

test("validador de recetas: cantidades positivas en productos, extras pueden restar, sin repetidos", () => {
  const line = { ingredientId: "i-1", quantity: 18 };
  assert.equal(productRecipeSchema.safeParse({ REGULAR: [line] }).success, true);
  assert.equal(productRecipeSchema.safeParse({ REGULAR: [{ ...line, quantity: 0 }] }).success, false);
  assert.equal(productRecipeSchema.safeParse({ REGULAR: [{ ...line, quantity: -5 }] }).success, false);
  assert.equal(productRecipeSchema.safeParse({ REGULAR: [line, line] }).success, false, "repeated ingredient");
  assert.equal(productRecipeSchema.safeParse({ REGULAR: [line], MEDIANO: [line] }).success, false, "unknown size");

  assert.equal(extraRecipeSchema.safeParse([{ ingredientId: "i-1", quantity: -200 }]).success, true);
  assert.equal(extraRecipeSchema.safeParse([{ ingredientId: "i-1", quantity: 0 }]).success, false);
});

test("el producto acepta receta, extras, familia y opciones sin repetir", () => {
  const base = { name: "Chilaquiles pollo rojos", price: 90, cost: 30 };
  assert.equal(createProductSchema.safeParse({
    ...base,
    tracksInventory: true,
    familyId: "f-1",
    variantLabel: "Pollo rojos",
    options: [{ name: "Salsa", value: "Roja" }, { name: "Proteína", value: "Pollo" }],
    extraIds: ["e-1"],
    recipe: { REGULAR: [{ ingredientId: "i-1", quantity: 120 }] },
  }).success, true);
  assert.equal(createProductSchema.safeParse({ ...base, options: [{ name: "Salsa", value: "Roja" }, { name: "salsa", value: "Verde" }] }).success, false);
  assert.equal(createProductSchema.safeParse({ ...base, extraIds: ["e-1", "e-1"] }).success, false);
});
