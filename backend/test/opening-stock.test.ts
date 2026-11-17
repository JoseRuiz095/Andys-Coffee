import assert from "node:assert/strict";
import { test } from "node:test";
import { INGREDIENT_CATALOG } from "../prisma/ingredient-catalog";
import { OPENING_STOCK, PIECE_WEIGHT_GRAMS, toBaseQuantity } from "../prisma/opening-stock";
import { normalizeIngredientName as normalize } from "../prisma/recipe-catalog";
import { assertProductionWriteConfirmed } from "../prisma/seed-guards";

const catalogUnit = new Map(INGREDIENT_CATALOG.map((entry) => [normalize(entry.name), entry.unit]));

test("saldo inicial: cada renglón de la hoja existe en el catálogo de insumos, una sola vez", () => {
  const names = OPENING_STOCK.map((entry) => normalize(entry.name));
  assert.equal(new Set(names).size, names.length, "renglones repetidos");
  assert.deepEqual(names.filter((name) => !catalogUnit.has(name)), []);
});

test("saldo inicial: convierte a la unidad base del catálogo; sólo fallan los casos sin dato", () => {
  const failures = OPENING_STOCK.filter((entry) => entry.stock !== null)
    .filter((entry) => !toBaseQuantity(entry, entry.stock!, catalogUnit.get(normalize(entry.name))!).ok)
    .map((entry) => entry.name);
  // Unknown piece weight (PIECE_WEIGHT_GRAMS) and the oil the sheet measures as "Suficiente?".
  const expected = ["Aceite para freir", ...Object.entries(PIECE_WEIGHT_GRAMS).filter(([, weight]) => !weight).map(([name]) => name)];
  assert.deepEqual(failures.sort(), expected.sort());
});

test("saldo inicial: kg → gr, L → ml, gr de jarabe → ml y gr ↔ pz con el peso por pieza", () => {
  assert.deepEqual(toBaseQuantity({ name: "Papas a la francesa", sheetUnit: "kg" }, 1.6, "gr"), { ok: true, value: 1600 });
  assert.deepEqual(toBaseQuantity({ name: "Jitomate", sheetUnit: "kg" }, 0.227, "gr"), { ok: true, value: 227 });
  assert.deepEqual(toBaseQuantity({ name: "Leche deslactosada", sheetUnit: "L" }, 2.7, "ml"), { ok: true, value: 2700 });
  assert.equal(toBaseQuantity({ name: "Bote mantequilla", sheetUnit: "bote" }, 6, "pz").ok, true);
  const syrup = toBaseQuantity({ name: "French Vainilla", sheetUnit: "g" }, 422, "ml");
  assert.ok(syrup.ok && syrup.value === 422 && syrup.note);
  assert.equal(toBaseQuantity({ name: "Popotes", sheetUnit: "g" }, 180, "pz").ok, false, "sin peso por pieza no se adivina");

  PIECE_WEIGHT_GRAMS["Vaso café caliente"] = 12;
  try {
    const cups = toBaseQuantity({ name: "Vaso café caliente", sheetUnit: "g" }, 772, "pz");
    assert.ok(cups.ok && cups.value === 64);
  } finally {
    PIECE_WEIGHT_GRAMS["Vaso café caliente"] = null;
  }
});

test("saldo inicial: en producción exige --confirm-host con el host exacto", () => {
  const prod = { envMode: "production", usesProductionDatabase: false, databaseHost: "db.example.supabase.co" };
  assert.throws(() => assertProductionWriteConfirmed({ ...prod, argv: ["--apply"] }), /PRODUCCIÓN/);
  assert.throws(() => assertProductionWriteConfirmed({ ...prod, argv: ["--apply", "--confirm-host=otro"] }), /PRODUCCIÓN/);
  assert.doesNotThrow(() => assertProductionWriteConfirmed({ ...prod, argv: ["--apply", "--confirm-host=db.example.supabase.co"] }));
  assert.throws(() => assertProductionWriteConfirmed({ ...prod, envMode: "development", usesProductionDatabase: true, argv: ["--apply"] }));
  assert.doesNotThrow(() => assertProductionWriteConfirmed({ ...prod, envMode: "development", argv: ["--apply"] }));
});
