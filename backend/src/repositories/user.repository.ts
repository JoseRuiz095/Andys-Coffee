import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export const UserRepository = {
  async findAll(where: Prisma.UserWhereInput = {}) {
    return prisma.user.findMany({
      where,
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
    });
  },

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
    const skip = (page - 1) * limit;

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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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

  async updatePasswordHash(id: string, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        roleId: true,
      },
    });
  },

  async delete(id: string) {
    return prisma.user.delete({ where: { id } });
  },

  async countActiveAdmins(adminRoleId: string) {
    return prisma.user.count({
      where: {
        roleId: adminRoleId,
        isActive: true,
      },
    });
  },
};
