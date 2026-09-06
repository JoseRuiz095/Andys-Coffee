import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createProductSchema, filterQuerySchema, updateProductSchema } from '../validators/product.validator';
import { z } from 'zod';
import { UploadService } from './upload.service';
import { auditLog } from '../utils/logger';
import { prisma } from '../config/prisma';
import { AuthUser } from './auth.service';

// Custom error for authorization checks within services
class AuthorizationError extends Error {
  constructor(message = 'El usuario no tiene permiso para realizar esta acción.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// Helper to enforce permission checks consistently
const ensureUserHasPermission = (user: AuthUser, permission: string) => {
  if (!user.permissions?.includes(permission)) {
    throw new AuthorizationError(`Permiso requerido: '${permission}'.`);
  }
};

export const ProductService = {
  async findAll(query: z.infer<typeof filterQuerySchema>) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      ...(query.category && { categoryId: query.category }),
      ...(query.isActive && { isActive: query.isActive === 'true' }),
      ...(query.search && {
        name: {
          contains: query.search,
          mode: 'insensitive',
        },
      }),
    };

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          displayOrder: 'asc',
        },
        include: {
          category: {
            select: { id: true, name: true }
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findOne(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        extras: { include: { extra: true } },
        recipes: { include: { ingredient: true } },
      },
    });
  },

  async create(productData: z.infer<typeof createProductSchema>, user: AuthUser, requestId?: string) {
    ensureUserHasPermission(user, 'manage:products');
    const newProduct = await prisma.product.create({
      data: { ...productData, categoryId: productData.categoryId ?? undefined, sku: productData.sku ?? `SKU-${randomUUID()}` },
    });
    auditLog({
      requestId,
      actor: { id: user.id, name: user.name },
      action: 'PRODUCT_CREATED',
      entity: 'product',
      entityId: newProduct.id,
    }, 'Product created');
    return newProduct;
  },

  async update(id: string, productData: z.infer<typeof updateProductSchema>, user: AuthUser, requestId?: string) {
    ensureUserHasPermission(user, 'manage:products');

    const originalProduct = await prisma.product.findUnique({
      where: { id },
      select: { price: true, cost: true, isActive: true, imageUrl: true },
    });

    if (!originalProduct) {
      throw new NotFoundError('Producto no encontrado.');
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { ...productData, categoryId: productData.categoryId ?? undefined, sku: productData.sku ?? undefined },
    });

    const changes: Record<string, { from: any; to: any }> = {};
    const fieldsToAudit = ['price', 'cost', 'isActive', 'imageUrl'];

    if (originalProduct) {
      for (const field of fieldsToAudit) {
        const oldValue = originalProduct[field as keyof typeof originalProduct];
        const newValue = productData[field as keyof typeof productData];

        if (newValue !== undefined && oldValue !== newValue) {
          changes[field] = { from: oldValue, to: newValue };
        }
      }
    }

    if (Object.keys(changes).length > 0) {
      auditLog({
        requestId,
        actor: { id: user.id, name: user.name },
        action: 'PRODUCT_UPDATED',
        entity: 'product',
        entityId: id,
        metadata: changes,
      }, 'Product updated');
    }

    return updatedProduct;
  },

  async remove(id: string, user: AuthUser, requestId?: string) {
    ensureUserHasPermission(user, 'manage:products');

    const productToDelete = await prisma.product.findUnique({
      where: { id },
      select: { imageUrl: true },
    });

    if (!productToDelete) {
      throw new NotFoundError('Producto no encontrado.');
    }

    auditLog({
      requestId,
      actor: { id: user.id, name: user.name },
      action: 'PRODUCT_DELETED',
      entity: 'product',
      entityId: id,
    }, 'Product deleted');

    await prisma.product.delete({
      where: { id },
    });

    if (productToDelete?.imageUrl) {
      await UploadService.deleteProductImage(productToDelete.imageUrl);
    }
  },
};