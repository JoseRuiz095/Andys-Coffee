import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { PurchaseService } from "../../src/services/purchase.service";
import type { AuthUser } from "../../src/services/auth.service";
import bcrypt from "bcrypt";

// Regression test for P0-2: PurchaseService.receivePurchase used to compute the
// weighted-average cost from a snapshot fetched once before the loop, so a purchase
// listing the same ingredient on two lines silently corrupted averageCost using
// pre-purchase stock/cost on the second line instead of the value left by the first.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();

let unitId: string;
let ingredientId: string;
let actor: AuthUser;
let userId: string;

before(async () => {
  if (!integrationEnabled) return;

  const unit = await prisma.inventoryUnit.create({
    data: { name: `test-unit-${testId}`, abbreviation: "u" },
  });
  unitId = unit.id;

  const ingredient = await prisma.ingredient.create({
    data: {
      name: `test-ingredient-${testId}`,
      unitId,
      currentStock: 10,
      averageCost: 5,
    },
  });
  ingredientId = ingredient.id;

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  const user = await prisma.user.create({
    data: {
      email: `purchase-cost-test-${testId}@test.local`,
      name: "Purchase Cost Test User",
      passwordHash: await bcrypt.hash("test-password-123", 12),
      roleId: adminRole.id,
      isActive: true,
    },
  });
  userId = user.id;

  actor = {
    id: user.id,
    email: user.email,
    name: user.name,
    roleId: user.roleId,
    roleName: "ADMIN",
    isActive: user.isActive,
    permissions: ["inventory.create_entry", "inventory.view"],
  };
});

after(async () => {
  if (!integrationEnabled) return;

  await prisma.inventoryMovement.deleteMany({ where: { ingredientId } });
  await prisma.purchaseItem.deleteMany({ where: { ingredientId } });
  await prisma.purchase.deleteMany({ where: { createdById: userId } });
  await prisma.ingredient.delete({ where: { id: ingredientId } });
  await prisma.inventoryUnit.delete({ where: { id: unitId } });
  await prisma.user.delete({ where: { id: userId } });
});

test(
  "receivePurchase calcula el costo promedio correctamente cuando el mismo ingrediente aparece en dos líneas",
  { skip: !integrationEnabled },
  async () => {
    const purchase = await PurchaseService.create(
      {
        items: [
          { ingredientId, quantity: "5", unitCost: "8" },
          { ingredientId, quantity: "3", unitCost: "11" },
        ],
      },
      actor,
    );

    await PurchaseService.receivePurchase(purchase.id, actor);

    const ingredient = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });

    // Stock is always correct because increments are atomic regardless of the bug.
    assert.equal(ingredient.currentStock.toNumber(), 18);

    // Correct running calculation: (10*5 + 5*8)/15 = 6 after line 1,
    // then (15*6 + 3*11)/18 = 6.8333... after line 2.
    const correctAverageCost = 6.8333;
    // The bug would have produced (10*5 + 3*11)/13 = 6.3846... by reusing the
    // pre-purchase snapshot for both lines instead of the running value.
    const buggyAverageCost = 6.3846;

    const actualAverageCost = ingredient.averageCost.toNumber();
    assert.ok(
      Math.abs(actualAverageCost - correctAverageCost) < 0.001,
      `expected averageCost close to ${correctAverageCost}, got ${actualAverageCost}`,
    );
    assert.ok(
      Math.abs(actualAverageCost - buggyAverageCost) > 0.01,
      `averageCost matches the known-buggy value ${buggyAverageCost}, regression reintroduced`,
    );
  },
);
