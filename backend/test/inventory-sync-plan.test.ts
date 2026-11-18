import assert from "node:assert/strict";
import { test } from "node:test";
import { planInventorySync, type SourceIngredient, type TargetIngredient } from "../scripts/lib/inventory-sync-plan";

const src = (sku: string, name: string, unit = "gr", minimumStock = 10): SourceIngredient =>
  ({ sku, name, unit, minimumStock, maximumStock: null, isActive: true });
const tgt = (id: string, sku: string | null, name: string, overrides: Partial<TargetIngredient> = {}): TargetIngredient =>
  ({ id, sku, name, unit: "gr", currentStock: 0, minimumStock: 0, maximumStock: null, isActive: true, historyCount: 0, ...overrides });

test("inventario dev→prod: empata por nombre, toma el SKU y el mínimo de dev y crea lo que falta en 0", () => {
  const plan = planInventorySync(
    [src("INS-001", "Café molido", "gr", 300), src("INS-090", "Vaso café caliente Jumbo", "pz", 0)],
    [tgt("p1", "PROD-002", "café molido")],
  );
  assert.deepEqual(plan.updates, [{ id: "p1", sourceSku: "INS-001", changes: { sku: "INS-001", name: "Café molido", minimumStock: 300 }, unitChangeWithHistory: false }]);
  assert.deepEqual(plan.creates.map((c) => c.sku), ["INS-090"]);
  assert.deepEqual(plan.problems, []);
});

test("inventario dev→prod: todo el stock de producción queda en 0, también lo exclusivo de producción", () => {
  const plan = planInventorySync(
    [src("INS-001", "Queso amarillo")],
    [tgt("p1", "PROD-050", "Queso Amarillo", { currentStock: 191 }), tgt("p2", "OP-01", "Gas", { unit: "ml", currentStock: 17000 })],
  );
  assert.deepEqual(plan.zeroes.map((z) => [z.id, z.currentStock]), [["p1", 191], ["p2", 17000]]);
  assert.deepEqual(plan.untouched, [{ sku: "OP-01", name: "Gas" }]);
});

test("inventario dev→prod: cambiar la unidad con historial exige autorización explícita", () => {
  const source = [src("INS-007", "Queso Amarillo", "gr")];
  const target = [tgt("p1", "PROD-050", "Queso Amarillo", { unit: "pz", historyCount: 1 })];
  const refused = planInventorySync(source, target);
  assert.equal(refused.updates.length, 0);
  assert.match(refused.problems[0], /--allow-unit-change=INS-007/);
  const allowed = planInventorySync(source, target, { allowUnitChange: new Set(["INS-007"]) });
  assert.equal(allowed.updates[0].changes.unit, "gr");
  assert.equal(allowed.updates[0].unitChangeWithHistory, true);
  // Without history the unit simply follows dev.
  assert.equal(planInventorySync([src("INS-008", "Popotes", "gr")], [tgt("p2", "PROD-028", "Popotes", { unit: "pz" })]).updates[0].changes.unit, "gr");
});

test("inventario dev→prod: idempotente; el nombre manda sobre un SKU numerado aparte en cada base", () => {
  const synced = planInventorySync([src("INS-001", "Café molido", "gr", 300)], [tgt("p1", "INS-001", "Café molido", { minimumStock: 300 })]);
  assert.deepEqual([synced.updates.length, synced.creates.length, synced.zeroes.length], [0, 0, 0]);

  // Production numbered its own INS-001 for another ingredient: it is not matched by SKU.
  const numbered = planInventorySync(
    [src("INS-001", "Café entero"), src("INS-050", "Queso Amarillo")],
    [tgt("p1", "PROD-001", "Café entero"), tgt("p2", "INS-001", "Queso amarillo")],
  );
  assert.deepEqual(numbered.problems, []);
  assert.deepEqual(numbered.updates.map((u) => [u.id, u.changes.sku]), [["p1", "INS-001"], ["p2", "INS-050"]]);

  // A production-only ingredient holding a SKU development needs gives it up.
  const prodOnly = planInventorySync([src("INS-002", "Vaso")], [tgt("p9", "INS-002", "Bolsa negra jumbo")]);
  assert.deepEqual(prodOnly.updates.map((u) => [u.id, u.changes.sku]), [["p9", "INS-002-PROD"]]);
  assert.deepEqual(prodOnly.creates.map((c) => c.sku), ["INS-002"]);
});

test("inventario dev→prod: entre homónimos manda la misma unidad; el homónimo sobrante se desactiva", () => {
  // PROD (17/11): "Queso amarillo" activo en pz con una compra real y "Queso Amarillo" inactivo en gr.
  const plan = planInventorySync(
    [src("INS-092", "Queso Amarillo", "gr")],
    [tgt("pz", "INS-001", "Queso amarillo", { unit: "pz", historyCount: 1, currentStock: 5 }), tgt("gr", "PROD-050", "Queso Amarillo", { unit: "gr", isActive: false })],
  );
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(plan.updates.find((u) => u.id === "gr")?.changes, { sku: "INS-092", minimumStock: 10, isActive: true });
  assert.deepEqual(plan.updates.find((u) => u.id === "pz")?.changes, { isActive: false }, "keeps its unit and history, frees the name");
  assert.ok(plan.updates.findIndex((u) => u.id === "pz") < plan.updates.findIndex((u) => u.id === "gr"), "deactivated before the other is activated");
  assert.deepEqual(plan.zeroes.map((z) => z.id), ["pz"]);
  const ambiguous = planInventorySync([src("INS-001", "Sal")], [tgt("p1", "A", "Sal"), tgt("p2", "B", "sal")]);
  assert.match(ambiguous.problems[0], /coincide con 2/);
});

test("inventario dev→prod: un homónimo borrado (soft delete) se restaura en lugar de duplicarse", () => {
  const plan = planInventorySync(
    [src("INS-061", "Bolsa camiseta amarilla", "gr", 50)],
    [tgt("del", "PROD-021", "Bolsa camiseta amarilla", { deleted: true })],
  );
  assert.deepEqual(plan.creates, []);
  assert.deepEqual(plan.updates[0].changes, { restore: true, sku: "INS-061", minimumStock: 50 });
  assert.deepEqual(plan.untouched, [], "deleted rows are not reported as production-only");
});
