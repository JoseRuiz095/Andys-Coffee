import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import type { AuthUser } from "../../src/services/auth.service";
import { InventoryService } from "../../src/services/inventory.service";
import { InventoryCountService } from "../../src/services/inventory-count.service";
import { PurchaseService } from "../../src/services/purchase.service";

// Inventory consistency: manual exits, physical counts (draft -> completed -> applied),
// atomic rollback when an adjustment would break the stock >= 0 constraint, and a
// purchase that can only be received once even under concurrent requests.
// Tests run in order and share one ingredient.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();

let admin: AuthUser;
let viewer: AuthUser;
let unitId: string;
let ingredientId: string;
const userIds: string[] = [];
let viewerRoleId: string;

const stockOf = async () =>
  (await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } })).currentStock.toNumber();

before(async () => {
  if (!integrationEnabled) return;

  const unit = await prisma.inventoryUnit.create({ data: { name: `inv-unit-${testId}`, abbreviation: "u" } });
  unitId = unit.id;
  const ingredient = await prisma.ingredient.create({
    data: { name: `inv-ingredient-${testId}`, unitId, currentStock: 10, averageCost: 2 },
  });
  ingredientId = ingredient.id;

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "ADMIN" },
    include: { permissions: { include: { permission: true } } },
  });
  const adminRecord = await prisma.user.create({
    data: { email: `inv-admin-${testId}@test.local`, name: "Inv Admin", passwordHash: "unused", roleId: adminRole.id },
  });
  userIds.push(adminRecord.id);
  admin = {
    id: adminRecord.id,
    name: adminRecord.name,
    email: adminRecord.email,
    roleId: adminRole.id,
    roleName: "ADMIN",
    isActive: true,
    permissions: adminRole.permissions.map(({ permission }) => permission.name),
  };

  const viewerRole = await prisma.role.create({ data: { name: `inv-viewer-${testId}` } });
  viewerRoleId = viewerRole.id;
  const viewerRecord = await prisma.user.create({
    data: { email: `inv-viewer-${testId}@test.local`, name: "Inv Viewer", passwordHash: "unused", roleId: viewerRole.id },
  });
  userIds.push(viewerRecord.id);
  viewer = { ...admin, id: viewerRecord.id, roleId: viewerRole.id, roleName: viewerRole.name, permissions: ["inventory.view"] };
});

after(async () => {
  if (!integrationEnabled) return;

  await prisma.inventoryMovement.deleteMany({ where: { ingredientId } });
  await prisma.inventoryCountItem.deleteMany({ where: { ingredientId } });
  await prisma.inventoryCount.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.purchaseItem.deleteMany({ where: { ingredientId } });
  await prisma.purchase.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.ingredient.deleteMany({ where: { id: ingredientId } });
  await prisma.inventoryUnit.deleteMany({ where: { id: unitId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.role.deleteMany({ where: { id: viewerRoleId } });
});

test("salida manual: descuenta stock, registra el movimiento y respeta stock, permisos y estado", { skip: !integrationEnabled }, async () => {
  const { movement } = await InventoryService.createExit({ ingredientId, quantity: "3", reason: "waste" }, admin);
  assert.equal(await stockOf(), 7);
  assert.equal(movement.type, "exit");
  assert.equal(movement.quantity.toNumber(), -3);
  assert.equal(movement.reason, "waste");

  await assert.rejects(
    InventoryService.createExit({ ingredientId, quantity: "100", reason: "waste" }, admin),
    (error: Error) => error.name === "ValidationError",
  );
  await assert.rejects(
    InventoryService.createExit({ ingredientId, quantity: "1", reason: "sample" }, viewer),
    (error: Error) => error.name === "AuthorizationError",
  );
  assert.equal(await stockOf(), 7, "rejected exits must not change stock");
});

test("conteo físico: draft -> completed -> applied ajusta el stock por la diferencia y no se aplica dos veces", { skip: !integrationEnabled }, async () => {
  const count = await InventoryCountService.createCount(admin);
  const item = await InventoryCountService.addItem(count.id, ingredientId, 5, "Conteo de prueba", admin);
  assert.equal(item.difference.toNumber(), -2); // counted 5 vs system 7

  await InventoryCountService.completeCount(count.id, admin);
  await assert.rejects(
    InventoryCountService.addItem(count.id, ingredientId, 4, null, admin),
    (error: Error) => error.name === "ValidationError",
  );

  await InventoryCountService.applyAdjustments(count.id, admin);
  assert.equal(await stockOf(), 5);
  const adjustment = await prisma.inventoryMovement.findFirstOrThrow({
    where: { ingredientId, referenceType: "inventory_count", referenceId: count.id },
  });
  assert.equal(adjustment.type, "adjustment");
  assert.equal(adjustment.quantity.toNumber(), -2);

  await assert.rejects(
    InventoryCountService.applyAdjustments(count.id, admin),
    (error: Error) => error.name === "ValidationError",
  );
  assert.equal(await stockOf(), 5, "applying twice must not adjust again");
});

test("L-10: un ajuste que dejaría stock negativo se rechaza completo (sin cambios parciales)", { skip: !integrationEnabled }, async () => {
  const count = await InventoryCountService.createCount(admin);
  await InventoryCountService.addItem(count.id, ingredientId, 0, null, admin); // difference -5
  await InventoryCountService.completeCount(count.id, admin);

  // Stock drops after the count was taken: applying -5 would leave it at -3.
  await InventoryService.createExit({ ingredientId, quantity: "3", reason: "internal_consumption" }, admin);
  assert.equal(await stockOf(), 2);

  await assert.rejects(InventoryCountService.applyAdjustments(count.id, admin));
  assert.equal(await stockOf(), 2, "stock unchanged after the failed adjustment");
  const stillCompleted = await prisma.inventoryCount.findUniqueOrThrow({ where: { id: count.id } });
  assert.equal(stillCompleted.status, "completed");
});

test("compra: se recibe una sola vez aunque lleguen dos recepciones simultáneas", { skip: !integrationEnabled }, async () => {
  const stockBefore = await stockOf();
  const purchase = await PurchaseService.create(
    { items: [{ ingredientId, quantity: "4", unitCost: "3" }] },
    admin,
  );

  const results = await Promise.allSettled([
    PurchaseService.receivePurchase(purchase.id, admin),
    PurchaseService.receivePurchase(purchase.id, admin),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, JSON.stringify(results.map((r) => r.status)));

  assert.equal(await stockOf(), stockBefore + 4);
  const purchaseMovements = await prisma.inventoryMovement.count({
    where: { ingredientId, referenceType: "purchase", referenceId: purchase.id },
  });
  assert.equal(purchaseMovements, 1);

  await assert.rejects(
    PurchaseService.receivePurchase(purchase.id, admin),
    (error: Error) => error.name === "ValidationError",
  );
  await assert.rejects(
    PurchaseService.deletePurchase(purchase.id, admin),
    (error: Error) => error.name === "ConflictError",
  );
});
