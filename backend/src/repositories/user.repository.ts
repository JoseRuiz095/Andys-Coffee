import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { paginationMeta, paginationOffset } from '../utils/pagination';

export const UserRepository = {

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        roleId: true,
        role: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async findByIdWithPasswordHash(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        isActive: true,
        roleId: true,
        role: { select: { id: true, name: true } },
      },
    });
  },

  async findByEmailNormalized(email: string) {
    return prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        roleId: true,
        role: { select: { id: true, name: true } },
      },
    });
  },

  async findWithPagination(page: number, limit: number, where: Prisma.UserWhereInput = {}) {
    const skip = paginationOffset(page, limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          roleId: true,
          role: { select: { id: true, name: true } },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: paginationMeta(page, limit, total),
    };
  },

  async create(data: { name: string; email: string; passwordHash: string; roleId: string }) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        roleId: data.roleId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        roleId: true,
        role: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  },

  async update(id: string, data: { name?: string; email?: string; roleId?: string }) {
    return prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.email !== undefined && { email: data.email?.trim() || undefined }),
        ...(data.roleId !== undefined && { roleId: data.roleId }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        roleId: true,
        role: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async setActive(id: string, isActive: boolean) {
    return prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        roleId: true,
        role: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  /** Sets a new password and revokes every existing session in the same write. */
  async updatePasswordHash(id: string, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        roleId: true,
        tokenVersion: true,
      },
    });
  },

  /** Revokes every session of the user (JWTs signed with an older version stop working). */
  async incrementTokenVersion(id: string) {
    return prisma.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });
  },

  async delete(id: string) {
    return prisma.user.delete({ where: { id } });
  },

  async findWithPermissionsForAuth(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        isActive: true,
        tokenVersion: true,
        role: {
          select: {
            name: true,
            permissions: {
              select: { permission: { select: { name: true } } },
            },
          },
        },
      },
    });
  },

  async findActiveByRoleNames(roleNames: string[]) {
    return prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: { in: roleNames, mode: 'insensitive' } },
      },
      select: { id: true },
    });
  },

  async countActiveAdmins(adminRoleId: string) {
    return prisma.user.count({
      where: {
        roleId: adminRoleId,
        isActive: true,
      },
    });
  },

  async countRelations(id: string) {
    const result = await prisma.user.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            createdOrders: true,
            createdPurchases: true,
            inventoryMovements: true,
            createdCashMovements: true,
            createdExpenses: true,
            openedCashSessions: true,
            closedCashSessions: true,
            inventoryCountsCreated: true,
            inventoryCountsCompleted: true,
            createdPayments: true,
            auditLogs: true,
          },
        },
      },
    });
    return result?._count ?? null;
  },
};
