import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { prisma } from "../../src/config/prisma";
import { UserService } from "../../src/services/user.service";
import { RoleService } from "../../src/services/role.service";
import type { AuthUser } from "../../src/services/auth.service";
import bcrypt from "bcrypt";

describe("[SEC] Escalación de Privilegios - H1 y H2", () => {
  let adminUser: AuthUser;
  let basicAdminUser: AuthUser;
  let testRole: { id: string; name: string };
  let testUser: any;
  let allPermissions: { id: string; name: string }[];

  beforeAll(async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "true") {
      console.log("Skipping integration tests - set RUN_INTEGRATION_TESTS=true");
      return;
    }

    // Create a test role with only users.update (limited admin)
    testRole = await prisma.role.create({
      data: {
        name: `test-role-${Date.now()}`,
        description: "Test role with users.update only",
      },
    });

    // Get all permissions
    allPermissions = await prisma.permission.findMany();

    // Create a limited admin with only users.update permission
    const basicAdminRole = await prisma.role.create({
      data: {
        name: `basic-admin-${Date.now()}`,
        description: "Basic admin with only users.update",
      },
    });

    // Assign only users.update to basicAdminRole
    const usersUpdatePerm = allPermissions.find((p) => p.name === "users.update");
    if (usersUpdatePerm) {
      await prisma.rolePermission.create({
        data: {
          roleId: basicAdminRole.id,
          permissionId: usersUpdatePerm.id,
        },
      });
    }

    // Create test users
    const passwordHash = await bcrypt.hash("test-password-123", 12);

    const adminDbUser = await prisma.user.create({
      data: {
        email: `admin-test-${Date.now()}@test.local`,
        name: "Admin Test User",
        passwordHash,
        roleId: (await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } })).id,
        isActive: true,
      },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    testUser = await prisma.user.create({
      data: {
        email: `user-test-${Date.now()}@test.local`,
        name: "Regular Test User",
        passwordHash,
        roleId: basicAdminRole.id,
        isActive: true,
      },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    // Build AuthUser objects
    adminUser = {
      id: adminDbUser.id,
      email: adminDbUser.email,
      name: adminDbUser.name,
      roleId: adminDbUser.roleId,
      roleName: adminDbUser.role?.name,
      isActive: adminDbUser.isActive,
      permissions: adminDbUser.role?.permissions.map((rp) => rp.permission.name) ?? [],
    };

    basicAdminUser = {
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
      roleId: testUser.roleId,
      roleName: testUser.role?.name,
      isActive: testUser.isActive,
      permissions: testUser.role?.permissions.map((rp: any) => rp.permission.name) ?? [],
    };
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUser?.id) await prisma.user.delete({ where: { id: testUser.id } });
    if (basicAdminUser?.id) {
      const userToDelete = await prisma.user.findUnique({ where: { id: basicAdminUser.id } });
      if (userToDelete) await prisma.user.delete({ where: { id: userToDelete.id } });
    }
    if (testRole?.id) await prisma.role.delete({ where: { id: testRole.id } });
  });

  describe("H1 - Prevención de auto-asignación de rol", () => {
    it("debe rechazar si un usuario intenta cambiar su propio roleId", async () => {
      const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });

      // El usuario basic-admin intenta cambiar su propio rol a ADMIN
      await expect(
        UserService.update(basicAdminUser.id, { roleId: adminRole.id }, basicAdminUser)
      ).rejects.toThrow("No puedes cambiar tu propio rol.");
    });

    it("debe permitir a un admin cambiar el rol de otro usuario (no a sí mismo)", async () => {
      const cashierRole = await prisma.role.findUniqueOrThrow({ where: { name: "CAJERO" } });
      const otherUser = await prisma.user.create({
        data: {
          email: `other-user-${Date.now()}@test.local`,
          name: "Other User",
          passwordHash: await bcrypt.hash("password", 12),
          roleId: testRole.id,
          isActive: true,
        },
      });

      try {
        // Admin should be able to change another user's role
        const result = await UserService.update(
          otherUser.id,
          { roleId: cashierRole.id },
          adminUser
        );

        expect(result?.roleId).toBe(cashierRole.id);
      } finally {
        await prisma.user.delete({ where: { id: otherUser.id } });
      }
    });
  });

  describe("H2 - Validación de permisos antes de asignar", () => {
    it("debe rechazar si un usuario intenta otorgar un permiso que no posee", async () => {
      const testRoleForPerm = await prisma.role.create({
        data: {
          name: `perm-test-${Date.now()}`,
          description: "Test role for permission validation",
        },
      });

      try {
        // basicAdminUser solo tiene users.update, no puede otorgar inventory.delete_ingredient
        const deleteIngredientPerm = allPermissions.find((p) => p.name === "inventory.delete_ingredient");
        if (!deleteIngredientPerm) {
          console.log("Skipping test: inventory.delete_ingredient permission not found");
          return;
        }

        await expect(
          RoleService.assignPermissions(testRoleForPerm.id, [deleteIngredientPerm.id], basicAdminUser)
        ).rejects.toThrow('No tienes el permiso "inventory.delete_ingredient" que intentas otorgar.');
      } finally {
        await prisma.role.delete({ where: { id: testRoleForPerm.id } });
      }
    });

    it("debe rechazar cambios de permisos del rol ADMIN sin el permiso roles.manage_system_permissions", async () => {
      const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
      const usersReadPerm = allPermissions.find((p) => p.name === "users.read");

      if (!usersReadPerm) {
        console.log("Skipping test: users.read permission not found");
        return;
      }

      // basicAdminUser no tiene roles.manage_system_permissions, debe ser rechazado
      await expect(
        RoleService.assignPermissions(adminRole.id, [usersReadPerm.id], basicAdminUser)
      ).rejects.toThrow("No tienes permiso para modificar los permisos de los roles del sistema.");
    });

    it("debe permitir a ADMIN (con roles.manage_system_permissions) cambiar permisos del rol ADMIN", async () => {
      const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
      const usersReadPerm = allPermissions.find((p) => p.name === "users.read");

      if (!usersReadPerm) {
        console.log("Skipping test: users.read permission not found");
        return;
      }

      // Admin tiene el permiso, debe funcionar
      const result = await RoleService.assignPermissions(adminRole.id, [usersReadPerm.id], adminUser);
      expect(result?.permissions).toContainEqual(expect.objectContaining({ permission: { name: "users.read" } }));
    });

    it("debe permitir otorgar un permiso que el actor ya posee", async () => {
      const testRoleForPerm = await prisma.role.create({
        data: {
          name: `perm-test-own-${Date.now()}`,
          description: "Test role for own permission validation",
        },
      });

      try {
        // basicAdminUser tiene users.update, puede otorgarlo a otro rol
        const usersUpdatePerm = allPermissions.find((p) => p.name === "users.update");
        if (!usersUpdatePerm) {
          console.log("Skipping test: users.update permission not found");
          return;
        }

        const result = await RoleService.assignPermissions(testRoleForPerm.id, [usersUpdatePerm.id], basicAdminUser);
        expect(result?.permissions).toContainEqual(expect.objectContaining({ permission: { name: "users.update" } }));
      } finally {
        await prisma.role.delete({ where: { id: testRoleForPerm.id } });
      }
    });
  });
});
