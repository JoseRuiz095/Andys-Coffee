import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createProductSchema, filterQuerySchema, updateProductSchema } from '../validators/product.validator';
import { z } from 'zod';
import { UploadService } from './upload.service';
import { auditLog } from '../utils/logger';
import { ProductRepository } from '../repositories/product.repository';
import { AuthUser } from './auth.service';
import { AuthorizationError, NotFoundError } from '../utils/errors';
import { paginationMeta, paginationOffset } from '../utils/pagination';

// Helper to enforce permission checks consistently
const ensureUserHasPermission = (user: AuthUser, permission: string) => {
  if (!user.permissions?.includes(permission)) {
    throw new AuthorizationError(`Permiso requerido: '${permission}'.`);
  }
};

export const ProductService = {
  async findAll(query: z.infer<typeof filterQuerySchema>) {
    const { page, limit } = query;
    const skip = paginationOffset(page, limit);

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

    const { products, total } = await ProductRepository.findWithPagination(where, skip, limit);

    return {
      data: products,
      pagination: paginationMeta(page, limit, total),
    };
  },

  async findOne(id: string) {
    const product = await ProductRepository.findById(id);
    if (!product) return null;

    // R-04: cost suggested from the recipe at current average ingredient cost. The product's
    // own `cost` stays manual (it is what sales snapshot); the UI offers this as a hint.
    const suggestedCost = product.recipes.length > 0
      ? product.recipes
          .reduce((total, recipe) => total.add(recipe.quantity.mul(recipe.ingredient.averageCost)), new Prisma.Decimal(0))
          .toDecimalPlaces(2)
      : null;

    return { ...product, suggestedCost };
  },

  async create(productData: z.infer<typeof createProductSchema>, user: AuthUser, requestId?: string) {
    ensureUserHasPermission(user, 'products.create');
    const newProduct = await ProductRepository.create({
      ...productData, categoryId: productData.categoryId ?? undefined, sku: productData.sku ?? `SKU-${randomUUID()}`,
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
    ensureUserHasPermission(user, 'products.update');

    const originalProduct = await ProductRepository.findAuditFieldsById(id);

    if (!originalProduct) {
      throw new NotFoundError('Producto no encontrado.');
    }

    const updatedProduct = await ProductRepository.update(id, {
      ...productData, categoryId: productData.categoryId ?? undefined, sku: productData.sku ?? undefined,
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
    ensureUserHasPermission(user, 'products.delete');

    const productToDelete = await ProductRepository.findImageById(id);

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

    await ProductRepository.delete(id);

    if (productToDelete?.imageUrl) {
      await UploadService.deleteProductImage(productToDelete.imageUrl);
    }
  },
};