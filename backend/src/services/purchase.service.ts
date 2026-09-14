import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { PurchaseRepository } from '../repositories/purchase.repository';
import { SupplierRepository } from '../repositories/supplier.repository';
import { createPurchaseSchema } from '../validators/purchase.validator';
import { AuthUser } from './auth.service';

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class AuthorizationError extends Error {
  constructor(message = 'No tienes permiso para realizar esta acción.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

class DuplicateError extends Error {
  public readonly type: 'INGREDIENT' | 'SUPPLIER';
  public readonly existingId: string;

  constructor(type: 'INGREDIENT' | 'SUPPLIER', message: string, existingId: string) {
    super(message);
    this.name = 'DuplicateError';
    this.type = type;
    this.existingId = existingId;
  }
}

export const PurchaseService = {
  async findAll(user: AuthUser, status?: string, page: number = 1, limit: number = 20) {
    // Authorization
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver las compras.');
    }

    return PurchaseRepository.findAll(status, page, limit);
  },

  async findOne(id: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver las compras.');
    }

    const purchase = await PurchaseRepository.findById(id);

    if (!purchase) {
      throw new NotFoundError('Compra no encontrada.');
    }

    return purchase;
  },

  async create(data: z.infer<typeof createPurchaseSchema>, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.create_entry')) {
      throw new AuthorizationError('No tienes permiso para crear compras.');
    }

    // Validate supplier if supplierName is provided without supplierId
    if (data.supplierName && !data.supplierId) {
      const existingSupplier = await SupplierRepository.findByNameNormalized(data.supplierName);
      if (existingSupplier) {
        throw new DuplicateError(
          'SUPPLIER',
          `Ya existe un proveedor con el nombre "${existingSupplier.name}".`,
          existingSupplier.id
        );
      }
    }

    // Validate all ingredients exist
    const ingredientIds = data.items.map(item => item.ingredientId);
    const ingredients = await prisma.ingredient.findMany({
      where: { id: { in: ingredientIds } },
    });

    if (ingredients.length !== ingredientIds.length) {
      throw new ValidationError('Algunos ingredientes no existen.');
    }

    // Calculate totals
    let subtotal = new Prisma.Decimal(0);
    for (const item of data.items) {
      const qty = new Prisma.Decimal(item.quantity);
      const cost = new Prisma.Decimal(item.unitCost);
      subtotal = subtotal.add(qty.mul(cost));
    }

    const tax = data.tax ? new Prisma.Decimal(data.tax) : new Prisma.Decimal(0);
    const total = subtotal.add(tax);

    // Create purchase with items
    const purchase = await prisma.purchase.create({
      data: {
        supplierId: data.supplierId,
        invoiceNumber: data.invoiceNumber,
        notes: data.notes,
        subtotal,
        tax,
        total,
        createdById: user.id,
        items: {
          createMany: {
            data: data.items.map(item => ({
              ingredientId: item.ingredientId,
              quantity: new Prisma.Decimal(item.quantity),
              unitCost: new Prisma.Decimal(item.unitCost),
              total: new Prisma.Decimal(item.quantity).mul(new Prisma.Decimal(item.unitCost)),
            })),
          },
        },
      },
      include: {
        items: {
          include: {
            ingredient: {
              include: {
                unit: true,
              },
            },
          },
        },
        supplier: true,
      },
    });

    return purchase;
  },

  async receivePurchase(purchaseId: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.create_entry')) {
      throw new AuthorizationError('No tienes permiso para recibir compras.');
    }

    return prisma.$transaction(async (tx) => {
      // Fetch purchase
      const purchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
        include: {
          items: {
            include: {
              ingredient: true,
            },
          },
        },
      });

      if (!purchase) {
        throw new NotFoundError('Compra no encontrada.');
      }

      if (purchase.status !== 'draft') {
        throw new ValidationError(`No se puede recibir una compra con estado: ${purchase.status}`);
      }

      if (purchase.items.length === 0) {
        throw new ValidationError('La compra no tiene items.');
      }

      // Process each item
      const inventoryMovements: Prisma.InventoryMovementCreateManyInput[] = [];

      for (const item of purchase.items) {
        const ingredient = item.ingredient;

        // Calculate new average cost (weighted average)
        // newAvgCost = (currentStock * currentCost + newQuantity * newCost) / (currentStock + newQuantity)
        const currentStock = new Prisma.Decimal(ingredient.currentStock);
        const currentCost = new Prisma.Decimal(ingredient.averageCost);
        const newQuantity = new Prisma.Decimal(item.quantity);
        const newUnitCost = new Prisma.Decimal(item.unitCost);

        let newAverageCost: Prisma.Decimal;

        if (currentStock.greaterThan(0)) {
          // Weighted average: (old_stock * old_cost + new_qty * new_cost) / total_stock
          const oldValue = currentStock.mul(currentCost);
          const newValue = newQuantity.mul(newUnitCost);
          const totalValue = oldValue.add(newValue);
          const totalStock = currentStock.add(newQuantity);
          newAverageCost = totalValue.div(totalStock);
        } else {
          // If no stock, just use the new cost
          newAverageCost = newUnitCost;
        }

        // Update ingredient stock and cost
        await tx.ingredient.update({
          where: { id: ingredient.id },
          data: {
            currentStock: { increment: item.quantity },
            averageCost: newAverageCost,
          },
        });

        // Create inventory movement record
        inventoryMovements.push({
          ingredientId: ingredient.id,
          type: 'purchase',
          quantity: item.quantity,
          unitCost: item.unitCost,
          referenceType: 'purchase',
          referenceId: purchase.id,
          notes: `Recepción de compra de ${item.quantity} ${ingredient.id}`,
          createdById: user.id,
        });
      }

      // Create all movements
      if (inventoryMovements.length > 0) {
        await tx.inventoryMovement.createMany({
          data: inventoryMovements,
        });
      }

      // Update purchase status
      const updatedPurchase = await tx.purchase.update({
        where: { id: purchaseId },
        data: { status: 'received' },
        include: {
          items: {
            include: {
              ingredient: {
                include: {
                  unit: true,
                },
              },
            },
          },
          supplier: true,
        },
      });

      return updatedPurchase;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },
};
