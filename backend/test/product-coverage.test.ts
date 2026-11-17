import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { recipeCoverage, type CoverageRecipeLine } from "../src/services/product-coverage.service";

const line = (
  name: string, quantity: number, stock: number,
  options: Partial<Pick<CoverageRecipeLine, "size" | "temperature">> = {},
): CoverageRecipeLine => ({
  size: options.size ?? "REGULAR",
  temperature: options.temperature ?? "BOTH",
  quantity: new Prisma.Decimal(quantity),
  ingredient: { id: name, name, currentStock: new Prisma.Decimal(stock), unit: { abbreviation: "gr" } },
});

test("cobertura: el insumo que menos alcanza fija las piezas", () => {
  const [variant] = recipeCoverage([line("Café molido", 12, 903), line("Leche", 250, 2700), line("Vaso", 1, 0)]);
  assert.equal(variant.units, 0);
  assert.deepEqual(variant.limitingIngredientIds, ["Vaso"]);
  assert.equal(variant.lines.find((l) => l.name === "Café molido")?.units, 75);
  assert.equal(variant.lines.find((l) => l.name === "Leche")?.units, 10);
});

test("cobertura: stock negativo cuenta como 0 y las divisiones exactas no pierden una pieza", () => {
  const [variant] = recipeCoverage([line("A", 0.1, 0.3), line("B", 5, -10)]);
  assert.equal(variant.lines.find((l) => l.name === "A")?.units, 3);
  assert.equal(variant.units, 0);
});

test("cobertura: una variante por tamaño y, si la receta cambia, por temperatura", () => {
  const variants = recipeCoverage([
    line("Café", 12, 120),
    line("Vaso caliente", 1, 5, { temperature: "HOT" }),
    line("Vaso frío", 1, 2, { temperature: "COLD" }),
    line("Café", 18, 120, { size: "JUMBO" }),
  ]);
  assert.deepEqual(variants.map((v) => [v.size, v.temperature, v.units]), [
    ["REGULAR", "HOT", 5], ["REGULAR", "COLD", 2], ["JUMBO", "HOT", 6], ["JUMBO", "COLD", 6],
  ]);
  assert.equal(recipeCoverage([line("Pan", 1, 4)])[0].temperature, null);
});
