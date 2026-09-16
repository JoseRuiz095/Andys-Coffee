import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { CashService } from "../../src/services/cash.service";

// Coverage for CashService, which had zero prior tests. Also exercises the FASE 3 fix:
// notification dispatch for open/close now happens after the transaction commits instead
// of inside it.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();

let userId: string;
let cashRegisterId: string;

before(async () => {
  if (!integrationEnabled) return;

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  const user = await prisma.user.create({
    data: {
      email: `cash-test-user-${testId}@test.local`,
      name: "Cash Test User",
      passwordHash: "not-used-directly",
      roleId: adminRole.id,
      isActive: true,
    },
  });
  userId = user.id;

  const cashRegister = await prisma.cashRegister.create({
    data: { name: `cash-test-register-${testId}` },
  });
  cashRegisterId = cashRegister.id;
});

after(async () => {
  if (!integrationEnabled) return;

  const sessions = await prisma.cashSession.findMany({ where: { cashRegisterId }, select: { id: true } });
  const sessionIds = sessions.map((s) => s.id);
  await prisma.notification.deleteMany({ where: { referenceId: { in: sessionIds } } });
  await prisma.cashMovement.deleteMany({ where: { cashSessionId: { in: sessionIds } } });
  await prisma.auditLog.deleteMany({ where: { cashSessionId: { in: sessionIds } } });
  await prisma.cashSession.deleteMany({ where: { cashRegisterId } });
  await prisma.cashRegister.deleteMany({ where: { id: cashRegisterId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

test(
  "openSession abre una sesión, registra el movimiento de apertura y notifica",
  { skip: !integrationEnabled },
  async () => {
    const session = await CashService.openSession({ openingAmount: 100, cashRegisterId }, userId);

    assert.equal(session.status, "open");
    assert.equal(session.openingAmount.toNumber(), 100);
    assert.equal(session.expectedAmount.toNumber(), 100);

    const openingMovement = await prisma.cashMovement.findFirst({
      where: { cashSessionId: session.id, type: "OPENING" },
    });
    assert.ok(openingMovement);

    const notification = await prisma.notification.findFirst({ where: { referenceId: session.id } });
    assert.ok(notification, "expected a notification to be created for the opened session");
  },
);

test(
  "openSession rechaza abrir una segunda sesión para la misma caja",
  { skip: !integrationEnabled },
  async () => {
    await assert.rejects(
      CashService.openSession({ openingAmount: 50, cashRegisterId }, userId),
      (error: Error) => error.name === "BusinessRuleError",
    );
  },
);

test(
  "closeSession cierra la sesión activa, calcula la diferencia y notifica",
  { skip: !integrationEnabled },
  async () => {
    const closed = await CashService.closeSession(userId, { closingAmount: 100, reason: "Cierre de prueba" });

    assert.ok(closed);
    assert.equal(closed?.status, "closed");
    assert.equal(closed?.difference?.toNumber(), 0);

    const notification = await prisma.notification.findFirst({ where: { referenceId: closed?.id } });
    assert.ok(notification, "expected a notification to be created for the closed session");
  },
);

test(
  "closeSession exige un motivo cuando hay diferencia",
  { skip: !integrationEnabled },
  async () => {
    const session = await CashService.openSession({ openingAmount: 20, cashRegisterId }, userId);

    await assert.rejects(
      CashService.closeSession(userId, { closingAmount: 25 }),
      (error: Error) => error.name === "BusinessRuleError",
    );

    // Clean up: close it properly so the register is free for other tests/runs.
    await CashService.closeSession(userId, { closingAmount: 20, reason: "Cierre de limpieza" });
    void session;
  },
);
