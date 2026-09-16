import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { UserService } from "../../src/services/user.service";
import type { AuthUser } from "../../src/services/auth.service";
import bcrypt from "bcrypt";

// Regression test for P1-5: UserService.deleteUser used to call UserRepository.delete
// without checking for related records, so deleting a user with order/purchase/etc.
// history raised a raw Prisma FK-constraint error instead of a clean ConflictError.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();

let actor: AuthUser;
let actorId: string;
let userWithHistoryId: string;
let userWithoutHistoryId: string;

before(async () => {
  if (!integrationEnabled) return;

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  const passwordHash = await bcrypt.hash("test-password-123", 12);

  const actorRecord = await prisma.user.create({
    data: {
      email: `delete-protect-actor-${testId}@test.local`,
      name: "Delete Protection Actor",
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });
  actorId = actorRecord.id;
  actor = {
    id: actorRecord.id,
    email: actorRecord.email,
    name: actorRecord.name,
    roleId: actorRecord.roleId,
    roleName: "ADMIN",
    isActive: actorRecord.isActive,
    permissions: ["users.delete", "users.read"],
  };

  const withHistory = await prisma.user.create({
    data: {
      email: `delete-protect-history-${testId}@test.local`,
      name: "User With History",
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });
  userWithHistoryId = withHistory.id;

  // Give this user history via an audit log entry (simple, no extra fixtures needed).
  await prisma.auditLog.create({
    data: {
      userId: userWithHistoryId,
      action: "TEST_EVENT",
      metadata: {},
    },
  });

  const withoutHistory = await prisma.user.create({
    data: {
      email: `delete-protect-clean-${testId}@test.local`,
      name: "User Without History",
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });
  userWithoutHistoryId = withoutHistory.id;
});

after(async () => {
  if (!integrationEnabled) return;

  await prisma.auditLog.deleteMany({ where: { userId: userWithHistoryId } });
  await prisma.user.deleteMany({ where: { id: { in: [userWithHistoryId, userWithoutHistoryId, actorId] } } });
});

test(
  "deleteUser rechaza con ConflictError a un usuario con historial en vez de un error crudo de FK",
  { skip: !integrationEnabled },
  async () => {
    await assert.rejects(
      UserService.deleteUser(userWithHistoryId, actor),
      (error: Error) => error.name === "ConflictError",
    );

    // The user must still exist (delete was blocked, not partially applied).
    const stillExists = await prisma.user.findUnique({ where: { id: userWithHistoryId } });
    assert.ok(stillExists);
  },
);

test(
  "deleteUser permite eliminar a un usuario sin historial",
  { skip: !integrationEnabled },
  async () => {
    await UserService.deleteUser(userWithoutHistoryId, actor);

    const deleted = await prisma.user.findUnique({ where: { id: userWithoutHistoryId } });
    assert.equal(deleted, null);
  },
);
