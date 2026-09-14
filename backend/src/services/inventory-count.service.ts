import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
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

export const InventoryCountService = {
  async createCount(user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.physical_count')) {
      throw new AuthorizationError('No tienes permiso para crear conteos físicos.');
    }

    return prisma.inventoryCount.create({
      data: {
        createdById: user.id,
        status: 'draft',
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
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },

  async findById(id: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver conteos.');
    }

    const count = await prisma.inventoryCount.findUnique({
      where: { id },
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
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        completedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!count) {
      throw new NotFoundError('Conteo no encontrado.');
    }

    return count;
  },

  async addItem(
    countId: string,
    ingredientId: string,
    countedQuantity: Prisma.Decimal | number,
    notes: string | null,
    user: AuthUser,
  ) {
    // Authorization
    if (!user.permissions?.includes('inventory.physical_count')) {
      throw new AuthorizationError('No tienes permiso para editar conteos.');
    }

    // Verify count exists and is draft
    const count = await prisma.inventoryCount.findUnique({
      where: { id: countId },
    });

    if (!count) {
      throw new NotFoundError('Conteo no encontrado.');
    }

    if (count.status !== 'draft') {
      throw new ValidationError('No se puede agregar items a un conteo que no está en draft.');
    }

    // Get current stock
    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!ingredient) {
      throw new NotFoundError('Ingrediente no encontrado.');
    }

    const countedQty = new Prisma.Decimal(countedQuantity);
    const systemQty = new Prisma.Decimal(ingredient.currentStock);
    const difference = countedQty.minus(systemQty);

    // Create or update item
    return prisma.inventoryCountItem.upsert({
      where: {
        inventoryCountId_ingredientId: {
          inventoryCountId: countId,
          ingredientId,
        },
      },
      create: {
        inventoryCountId: countId,
        ingredientId,
        systemQuantity: systemQty,
        countedQuantity: countedQty,
        difference,
        notes,
      },
      update: {
        countedQuantity: countedQty,
        difference,
        notes,
      },
      include: {
        ingredient: {
          include: {
            unit: true,
          },
        },
      },
    });
  },

  async completeCount(countId: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.physical_count')) {
      throw new AuthorizationError('No tienes permiso para completar conteos.');
    }

    const count = await prisma.inventoryCount.findUnique({
      where: { id: countId },
      include: {
        items: true,
      },
    });

    if (!count) {
      throw new NotFoundError('Conteo no encontrado.');
    }

    if (count.status !== 'draft') {
      throw new ValidationError('Solo se pueden completar conteos en draft.');
    }

    if (count.items.length === 0) {
      throw new ValidationError('El conteo debe tener al menos un item.');
    }

    return prisma.inventoryCount.update({
      where: { id: countId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        completedById: user.id,
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
      },
    });
  },

  async applyAdjustments(countId: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.adjust')) {
      throw new AuthorizationError('No tienes permiso para aplicar ajustes.');
    }

    return prisma.$transaction(async (tx) => {
      const count = await tx.inventoryCount.findUnique({
        where: { id: countId },
        include: {
          items: {
            include: {
              ingredient: true,
            },
          },
        },
      });

      if (!count) {
        throw new NotFoundError('Conteo no encontrado.');
      }

      if (count.status !== 'completed') {
        throw new ValidationError('Solo se pueden aplicar ajustes a conteos completados.');
      }

      const inventoryMovements: Prisma.InventoryMovementCreateManyInput[] = [];

      // Apply adjustments for each item with difference
      for (const item of count.items) {
        if (item.difference.eq(0)) continue;

        // Update ingredient stock
        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: {
            currentStock: { increment: item.difference },
          },
        });

        // Create inventory movement
        inventoryMovements.push({
          ingredientId: item.ingredientId,
          type: 'adjustment',
          quantity: item.difference,
          unitCost: item.ingredient.averageCost,
          referenceType: 'inventory_count',
          referenceId: countId,
          notes: `Ajuste por conteo físico: ${item.difference.toString()} ${item.ingredient.id}`,
          createdById: user.id,
        });
      }

      // Create movements
      if (inventoryMovements.length > 0) {
        await tx.inventoryMovement.createMany({
          data: inventoryMovements,
        });
      }

      // Update count status
      return tx.inventoryCount.update({
        where: { id: countId },
        data: {
          status: 'applied',
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
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },
};
