import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { InventoryCountRepository } from '../repositories/inventory-count.repository';
import { InventoryRepository } from '../repositories/inventory.repository';
import { AuthUser } from './auth.service';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '../utils/errors';

export const InventoryCountService = {
  async findAll(user: AuthUser, page: number = 1, limit: number = 20, status?: string, date?: string) {
    // Authorization
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver conteos.');
    }

    return InventoryCountRepository.findAll(page, limit, status, date);
  },

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

  async removeItem(countId: string, ingredientId: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.physical_count')) {
      throw new AuthorizationError('No tienes permiso para editar conteos.');
    }

    const count = await InventoryCountRepository.findByIdWithItems(countId);

    if (!count) {
      throw new NotFoundError('Conteo no encontrado.');
    }

    if (count.status !== 'draft') {
      throw new ValidationError('No se pueden quitar items de un conteo que no está en draft.');
    }

    const item = count.items.find((i) => i.ingredientId === ingredientId);

    if (!item) {
      throw new NotFoundError('El ingrediente no está en este conteo.');
    }

    await InventoryCountRepository.deleteItem(countId, ingredientId);
  },

  async deleteCount(id: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.physical_count')) {
      throw new AuthorizationError('No tienes permiso para eliminar conteos.');
    }

    const count = await InventoryCountRepository.findById(id);

    if (!count) {
      throw new NotFoundError('Conteo no encontrado.');
    }

    if (count.status !== 'draft') {
      throw new ConflictError('Este conteo ya fue completado o aplicado; no se puede eliminar.');
    }

    await InventoryCountRepository.delete(id);
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

        // L-10: stock may have dropped since the count was taken (sales/exits); an adjustment
        // that would leave it negative is rejected with a clear message instead of a DB error.
        const resultingStock = item.ingredient.currentStock.add(item.difference);
        if (resultingStock.lt(0)) {
          throw new ValidationError(
            `El ajuste de "${item.ingredient.name}" dejaría el stock en ${resultingStock.toString()}. ` +
            'El stock cambió desde el conteo: registra un conteo nuevo.',
          );
        }

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
