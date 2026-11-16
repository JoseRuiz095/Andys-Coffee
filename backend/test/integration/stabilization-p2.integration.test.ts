import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { app } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import type { AuthUser } from "../../src/services/auth.service";
import { CashService } from "../../src/services/cash.service";
import { ExpenseService } from "../../src/services/expense.service";
import { InventoryService } from "../../src/services/inventory.service";
import { PurchaseService } from "../../src/services/purchase.service";
import { InventoryCountService } from "../../src/services/inventory-count.service";
import { addCalendarDays, getTodayInZone, getZonedInstant } from "../../src/utils/businessDate";

// P2 findings of the stabilization audit (2026-11-14): EX-2, INV-6, INV-8, INV-3 and R3.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();
let admin: AuthUser;
let unitId: string;
let ingredientId: string;
let inactiveIngredientId: string;
let registerId: string;
let inactiveCategoryId: string;
let server: Server;
let baseUrl: string;
const userIds: string[] = [];

before(async () => {
  if (!integrationEnabled) return;
  await prisma.cashSession.updateMany({ where: { status: "open" }, data: { status: "closed", closedAt: new Date() } });
  const unit = await prisma.inventoryUnit.create({ data: { name: `p2-unit-${testId}`, abbreviation: `p2-${testId}` } });
  unitId = unit.id;
  ingredientId = (await prisma.ingredient.create({ data: { name: `p2-ing-${testId}`, unitId, currentStock: 2, averageCost: 1 } })).id;
  inactiveIngredientId = (await prisma.ingredient.create({ data: { name: `p2-off-${testId}`, unitId, currentStock: 0, isActive: false } })).id;
  registerId = (await prisma.cashRegister.create({ data: { name: `p2-register-${testId}` } })).id;
  inactiveCategoryId = (await prisma.category.create({ data: { name: `p2-cat-${testId}`, isActive: false } })).id;

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" }, include: { permissions: { include: { permission: true } } } });
  const record = await prisma.user.create({ data: { email: `p2-admin-${testId}@test.local`, name: "P2 Admin", passwordHash: "unused", roleId: adminRole.id } });
  userIds.push(record.id);
  admin = { id: record.id, name: record.name, email: record.email, roleId: adminRole.id, roleName: "ADMIN", isActive: true, permissions: adminRole.permissions.map(({ permission }) => permission.name) };

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (!integrationEnabled) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const open = await CashService.getActiveSession();
  if (open) await CashService.closeSession(admin.id, { closingAmount: Number(open.expectedAmount) });
  const sessions = (await prisma.cashSession.findMany({ where: { cashRegisterId: registerId }, select: { id: true } })).map((s) => s.id);
  await prisma.notification.deleteMany({ where: { referenceId: { in: sessions } } });
  await prisma.expense.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.cashMovement.deleteMany({ where: { cashSessionId: { in: sessions } } });
  await prisma.inventoryMovement.deleteMany({ where: { ingredientId: { in: [ingredientId, inactiveIngredientId] } } });
  await prisma.inventoryCount.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.purchase.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.cashSession.deleteMany({ where: { cashRegisterId: registerId } });
  await prisma.cashRegister.deleteMany({ where: { id: registerId } });
  await prisma.ingredient.deleteMany({ where: { id: { in: [ingredientId, inactiveIngredientId] } } });
  await prisma.inventoryUnit.deleteMany({ where: { id: unitId } });
  await prisma.category.deleteMany({ where: { id: inactiveCategoryId } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

test("EX-2: un gasto en efectivo lleva la fecha del día de la caja abierta", { skip: !integrationEnabled }, async () => {
  const session = await CashService.openSession({ openingAmount: 100, cashRegisterId: registerId }, admin.id);
  const sessionDay = getTodayInZone();
  await assert.rejects(
    ExpenseService.create({ category: "otros", description: `p2-old-${testId}`, amount: 5, paymentMethod: "cash", expenseDate: addCalendarDays(sessionDay, -3) }, admin.id),
    /fecha debe ser la de esa caja/,
  );
  // Another day is fine when it doesn't come out of the drawer.
  await ExpenseService.create({ category: "otros", description: `p2-transfer-${testId}`, amount: 5, paymentMethod: "transfer", expenseDate: addCalendarDays(sessionDay, -3) }, admin.id);
  const ok = await ExpenseService.create({ category: "otros", description: `p2-today-${testId}`, amount: 5, paymentMethod: "cash", expenseDate: sessionDay }, admin.id);
  assert.equal(ok.cashSessionId, session.id);
  await CashService.closeSession(admin.id, { closingAmount: 95 });
});

test("INV-6: una merma se registra aunque deje el stock en negativo", { skip: !integrationEnabled }, async () => {
  await InventoryService.createExit({ ingredientId, quantity: "5", reason: "waste" }, admin);
  const ingredient = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
  assert.equal(ingredient.currentStock.toNumber(), -3);
});

test("INV-8: no se compran ingredientes inactivos", { skip: !integrationEnabled }, async () => {
  await assert.rejects(
    PurchaseService.create({ items: [{ ingredientId: inactiveIngredientId, quantity: "1", unitCost: "1" }] } as Parameters<typeof PurchaseService.create>[0], admin, `p2-buy-${testId}`),
    /inactivos/,
  );
});

test("INV-3: el filtro por fecha de conteos usa el día local, no el día UTC", { skip: !integrationEnabled }, async () => {
  const count = await InventoryCountService.createCount(admin);
  // 20:00 local of a past day is already the next day in UTC.
  const day = "2025-06-10";
  await prisma.inventoryCount.update({ where: { id: count.id }, data: { createdAt: getZonedInstant(day, 20 * 60) } });
  const { InventoryCountRepository } = await import("../../src/repositories/inventory-count.repository");
  const found = await InventoryCountRepository.findAll(1, 50, undefined, day);
  assert.ok(JSON.stringify(found).includes(count.id), "el conteo de las 20:00 locales pertenece a ese día");
});

test("R3: categorías públicas sin inactivas; ?includeInactive pide permiso; paginación inválida → 400", { skip: !integrationEnabled }, async () => {
  const pub = await fetch(`${baseUrl}/api/categories`);
  assert.equal(pub.status, 200);
  const body = (await pub.json()) as { categories: { id: string }[] };
  assert.ok(!body.categories.some((c) => c.id === inactiveCategoryId));
  assert.equal((await fetch(`${baseUrl}/api/categories?includeInactive=true`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/categories?page=-1`)).status, 400);
});
