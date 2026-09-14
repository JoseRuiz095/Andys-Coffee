import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export const SupplierRepository = {
  async findAll(where: Prisma.SupplierWhereInput = {}) {
    return prisma.supplier.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  },

  async findById(id: string) {
    return prisma.supplier.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        purchases: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  },

  async findByNameNormalized(name: string) {
    // Búsqueda exacta por nombre normalizado (case-insensitive)
    return prisma.supplier.findFirst({
      where: {
        isActive: true,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        isActive: true,
        createdAt: true,
      },
    });
  },

  async searchByName(query: string, limit: number = 20) {
    // Búsqueda fuzzy de proveedores por nombre
    return prisma.supplier.findMany({
      where: {
        isActive: true,
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    });
  },

  async findWithPagination(page: number, limit: number, where: Prisma.SupplierWhereInput = {}) {
    const skip = (page - 1) * limit;

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      data: suppliers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async create(data: { name: string; phone?: string; email?: string; address?: string }) {
    return prisma.supplier.create({
      data: {
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        isActive: true,
        createdAt: true,
      },
    });
  },
};
