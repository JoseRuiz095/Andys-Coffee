import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { computeConsumption, crossedThreshold, type RecipesForSale, type SaleLineForConsumption } from "../src/services/inventory-consumption.service";

const d = (value: number) => new Prisma.Decimal(value);

const recipes: RecipesForSale = {
  products: [
    {
      id: "latte",
      tracksInventory: true,
      temperature: null,
      recipes: [
        { size: "REGULAR", temperature: "BOTH", ingredientId: "coffee", quantity: d(18) },
        { size: "REGULAR", temperature: "BOTH", ingredientId: "milk", quantity: d(200) },
        { size: "REGULAR", temperature: "BOTH", ingredientId: "cup", quantity: d(1) },
        { size: "REGULAR", temperature: "BOTH", ingredientId: "lid", quantity: d(1) },
        { size: "JUMBO", temperature: "BOTH", ingredientId: "coffee", quantity: d(27) },
        { size: "JUMBO", temperature: "BOTH", ingredientId: "milk", quantity: d(300) },
        { size: "JUMBO", temperature: "BOTH", ingredientId: "cup", quantity: d(1) },
      ],
    },
    { id: "americano", tracksInventory: true, temperature: null, recipes: [{ size: "REGULAR", temperature: "BOTH", ingredientId: "coffee", quantity: d(18) }] },
    { id: "service", tracksInventory: false, temperature: null, recipes: [{ size: "REGULAR", temperature: "BOTH", ingredientId: "cup", quantity: d(1) }] },
    { id: "no-recipe", tracksInventory: true, temperature: null, recipes: [] },
  ],
  extras: [
    { id: "shot", recipes: [{ ingredientId: "coffee", quantity: d(9) }] },
    { id: "almond", recipes: [{ ingredientId: "almond-milk", quantity: d(200) }, { ingredientId: "milk", quantity: d(-200) }] },
    { id: "no-milk-x2", recipes: [{ ingredientId: "milk", quantity: d(-400) }] },
  ],
};

const line = (orderItemId: string, productId: string, quantity: number, extras: [string, number][] = [], size: "REGULAR" | "JUMBO" = "REGULAR"): SaleLineForConsumption => ({
  orderItemId,
  productId,
  size,
  temperature: null,
  quantity: d(quantity),
  extras: extras.map(([extraId, amount]) => ({ extraId, quantity: d(amount) })),
});

const asMap = (lines: SaleLineForConsumption[]) =>
  Object.fromEntries(computeConsumption(lines, recipes).map((c) => [`${c.orderItemId}:${c.ingredientId}`, c.quantity.toNumber()]));

test("C-01: un latte regular ×2 consume el doble de cada insumo", () => {
  assert.deepEqual(asMap([line("l1", "latte", 2)]), { "l1:coffee": 36, "l1:milk": 400, "l1:cup": 2, "l1:lid": 2 });
});

test("C-02: la línea Jumbo usa su receta; sin receta Jumbo se usa la regular", () => {
  assert.deepEqual(asMap([line("l1", "latte", 1, [], "JUMBO")]), { "l1:coffee": 27, "l1:milk": 300, "l1:cup": 1 });
  assert.deepEqual(asMap([line("l1", "americano", 1, [], "JUMBO")]), { "l1:coffee": 18 });
});

test("C-03/C-04: los extras suman; una sustitución resta y el neto nunca es negativo", () => {
  // Extras carry the line total: 2 lattes with 1 shot each = 2 shots.
  assert.equal(asMap([line("l1", "latte", 2, [["shot", 2]])])["l1:coffee"], 54);
  const almond = asMap([line("l1", "latte", 1, [["almond", 1]])]);
  assert.equal(almond["l1:almond-milk"], 200);
  assert.equal(almond["l1:milk"], undefined, "whole milk nets to 0 and is not consumed");
  assert.equal(asMap([line("l1", "latte", 1, [["no-milk-x2", 1]])])["l1:milk"], undefined, "never below zero");
});

test("C-05: combos llegan como líneas por producto y cada línea consume por separado", () => {
  assert.deepEqual(asMap([line("c1", "latte", 1), line("c2", "americano", 2)]), {
    "c1:coffee": 18, "c1:milk": 200, "c1:cup": 1, "c1:lid": 1, "c2:coffee": 36,
  });
});

test("productos que no controlan inventario o sin receta no consumen", () => {
  assert.deepEqual(asMap([line("s1", "service", 3), line("n1", "no-recipe", 1), line("u1", "unknown", 1)]), {});
});

test("umbral de alerta: sólo al cruzar el mínimo o al agotarse", () => {
  assert.equal(crossedThreshold(d(12), d(9), d(10)), true, "crosses the minimum");
  assert.equal(crossedThreshold(d(9), d(7), d(10)), false, "already below: no repeated alert");
  assert.equal(crossedThreshold(d(5), d(-1), d(0)), true, "runs out with minimum 0");
  assert.equal(crossedThreshold(d(3), d(-2), d(10)), true, "runs out while already low");
  assert.equal(crossedThreshold(d(-2), d(-5), d(10)), false, "already negative");
  assert.equal(crossedThreshold(d(10), d(20), d(10)), false, "a reversal never alerts");
});

// Recipes per temperature (2026-11-16): a product sold hot and cold consumes the BOTH lines plus
// those of the temperature chosen on the line.
test("temperatura: un latte frío usa vaso frío y hielo; uno caliente, vaso caliente; ambos la leche", () => {
  const hotCold: RecipesForSale = {
    products: [{
      id: "latte2",
      tracksInventory: true,
      temperature: "BOTH",
      recipes: [
        { size: "REGULAR", temperature: "BOTH", ingredientId: "coffee", quantity: d(12) },
        { size: "REGULAR", temperature: "HOT", ingredientId: "milk", quantity: d(300) },
        { size: "REGULAR", temperature: "HOT", ingredientId: "hot-cup", quantity: d(1) },
        { size: "REGULAR", temperature: "COLD", ingredientId: "milk", quantity: d(250) },
        { size: "REGULAR", temperature: "COLD", ingredientId: "cold-cup", quantity: d(1) },
        { size: "REGULAR", temperature: "COLD", ingredientId: "ice", quantity: d(160) },
      ],
    }],
    extras: [],
  };
  const sale = (id: string, temperature: "HOT" | "COLD" | null): SaleLineForConsumption => ({
    orderItemId: id, productId: "latte2", size: "REGULAR", temperature, quantity: d(1), extras: [],
  });
  const map = (lines: SaleLineForConsumption[]) =>
    Object.fromEntries(computeConsumption(lines, hotCold).map((c) => [`${c.orderItemId}:${c.ingredientId}`, c.quantity.toNumber()]));

  assert.deepEqual(map([sale("frio", "COLD")]), { "frio:coffee": 12, "frio:milk": 250, "frio:cold-cup": 1, "frio:ice": 160 });
  assert.deepEqual(map([sale("caliente", "HOT")]), { "caliente:coffee": 12, "caliente:milk": 300, "caliente:hot-cup": 1 });
  // Without a temperature on the line, a both-ways product uses the hot recipe.
  assert.deepEqual(map([sale("sin", null)]), { "sin:coffee": 12, "sin:milk": 300, "sin:hot-cup": 1 });
});
