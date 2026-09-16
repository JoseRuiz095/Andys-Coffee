import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export const RoleRepository = {
  async findAll() {
    return prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { users: true } },
        permissions: {
          select: {
            permission: {
              select: { id: true, name: true, description: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  },

  async findById(id: string) {
    return prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { users: true } },
        permissions: {
          select: {
            permission: {
              select: { id: true, name: true, description: true },
            },
          },
        },
      },
    });
  },

  async findByNameNormalized(name: string) {
    return prisma.role.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
  },

  async create(data: { name: string; description?: string }) {
    return prisma.role.create({
      data: {
        name: data.name,
        description: data.description || null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: { select: { users: true } },
        permissions: {
          select: {
            permission: {
              select: { id: true, name: true, description: true },
            },
          },
        },
      },
    });
  },

  async update(id: string, data: { name?: string; description?: string }) {
    return prisma.role.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { users: true } },
        permissions: {
          select: {
            permission: {
              select: { id: true, name: true, description: true },
            },
          },
        },
      },
    });
  },

  async delete(id: string) {
    return prisma.role.delete({ where: { id } });
  },

  async countUsersWithRole(id: string) {
    return prisma.user.count({ where: { roleId: id } });
  },

  async replacePermissions(roleId: string, permissionIds: string[]) {
    return prisma.$transaction(async (tx) => {
      // Delete existing permissions for this role
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // Create new permissions
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        });
      }

      // Return updated role
      return tx.role.findUnique({
        where: { id: roleId },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { users: true } },
          permissions: {
            select: {
              permission: {
                select: { id: true, name: true, description: true },
              },
            },
          },
        },
      });
    });
  },
};

export const PermissionRepository = {
  async findAll() {
    return prisma.permission.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  },
};
