import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import type { AuthUser } from "../../src/services/auth.service";
import { OrderService } from "../../src/services/order.service";

// C-13: the orders board asks for open orders of any day plus today's orders, so old finished
// orders don't push active ones out of its page.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();
let admin: AuthUser;
const orderIds: Record<string, string> = {};

before(async () => {
  if (!integrationEnabled) return;
  const role = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" }, include: { permissions: { include: { permission: true } } } });
  const user = await prisma.user.create({ data: { email: `board-${testId}@test.local`, name: "Board", passwordHash: "unused", roleId: role.id } });
  admin = { id: user.id, name: user.name, email: user.email, roleId: role.id, roleName: "ADMIN", isActive: true, permissions: role.permissions.map(({ permission }) => permission.name) };

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const rows = {
    oldCompleted: { status: "completed" as const, createdAt: twoDaysAgo },
    oldPending: { status: "pending" as const, createdAt: twoDaysAgo },
    todayCompleted: { status: "completed" as const, createdAt: new Date() },
  };
  for (const [name, data] of Object.entries(rows)) {
    const order = await prisma.order.create({ data: { ...data, customerName: `board-${name}-${testId}`, createdById: user.id } });
    orderIds[name] = order.id;
  }
});

after(async () => {
  if (!integrationEnabled) return;
  await prisma.order.deleteMany({ where: { id: { in: Object.values(orderIds) } } });
  await prisma.user.deleteMany({ where: { id: admin.id } });
});

test("el tablero trae órdenes abiertas de cualquier día y las de hoy, no las terminadas de días anteriores", { skip: !integrationEnabled }, async () => {
  const { data } = await OrderService.findAll({ page: 1, limit: 100, board: true, search: `board-` }, admin);
  const ids = new Set(data.map((order) => order.id));
  assert.ok(ids.has(orderIds.oldPending), "an open order from another day stays on the board");
  assert.ok(ids.has(orderIds.todayCompleted), "today's completed order is listed");
  assert.equal(ids.has(orderIds.oldCompleted), false, "finished orders from other days are left out");

  const all = await OrderService.findAll({ page: 1, limit: 100, search: `board-` }, admin);
  assert.ok(all.data.some((order) => order.id === orderIds.oldCompleted), "without board, every order is searchable");
});
