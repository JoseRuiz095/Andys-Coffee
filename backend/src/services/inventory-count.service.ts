import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { InventoryCountRepository } from '../repositories/inventory-count.repository';
import { InventoryRepository } from '../repositories/inventory.repository';
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

    return InventoryCountRepository.create({
      createdById: user.id,
      status: 'draft',
    });
  },

  async findById(id: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver conteos.');
    }

    const count = await InventoryCountRepository.findById(id);

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
    const count = await InventoryCountRepository.findById(countId);

    if (!count) {
      throw new NotFoundError('Conteo no encontrado.');
    }

    if (count.status !== 'draft') {
      throw new ValidationError('No se puede agregar items a un conteo que no está en draft.');
    }

    // Get current stock
    const ingredients = await InventoryCountRepository.findIngredientsForCount([ingredientId]);
    const ingredient = ingredients[0];

    if (!ingredient) {
      throw new NotFoundError('Ingrediente no encontrado.');
    }

    const countedQty = new Prisma.Decimal(countedQuantity);
    const systemQty = new Prisma.Decimal(ingredient.currentStock);
    const difference = countedQty.minus(systemQty);

    // Create or update item
    return InventoryCountRepository.upsertItem(
      countId,
      ingredientId,
      {
        systemQuantity: systemQty,
        countedQuantity: countedQty,
        difference,
        notes,
      },
    );
  },

  async completeCount(countId: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.physical_count')) {
      throw new AuthorizationError('No tienes permiso para completar conteos.');
    }

    const count = await InventoryCountRepository.findByIdWithItems(countId);

    if (!count) {
      throw new NotFoundError('Conteo no encontrado.');
    }

    if (count.status !== 'draft') {
      throw new ValidationError('Solo se pueden completar conteos en draft.');
    }

    if (count.items.length === 0) {
      throw new ValidationError('El conteo debe tener al menos un item.');
    }

    return InventoryCountRepository.updateStatus(countId, 'completed', user.id);
  },

  async applyAdjustments(countId: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.adjust')) {
      throw new AuthorizationError('No tienes permiso para aplicar ajustes.');
    }

    return prisma.$transaction(async (tx) => {
      const count = await InventoryCountRepository.findByIdWithItems(countId, tx);

      if (!count) {
        throw new NotFoundError('Conteo no encontrado.');
      }

      if (count.status !== 'completed') {
        throw new ValidationError('Solo se pueden aplicar ajustes a conteos completados.');
      }

      // Apply adjustments for each item with difference
      for (const item of count.items) {
        if (item.difference.eq(0)) continue;

        // Update ingredient stock
        await InventoryRepository.updateStock(item.ingredientId, item.difference, tx);

        // Create inventory movement
        await InventoryRepository.createMovement(
          {
            ingredientId: item.ingredientId,
            type: 'adjustment',
            quantity: item.difference,
            unitCost: item.ingredient.averageCost,
            referenceType: 'inventory_count',
            referenceId: countId,
            notes: `Ajuste por conteo físico: ${item.difference.toString()}`,
            createdById: user.id,
          },
          tx,
        );
      }

      // Update count status
      return InventoryCountRepository.updateStatus(countId, 'applied', undefined, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },
};
