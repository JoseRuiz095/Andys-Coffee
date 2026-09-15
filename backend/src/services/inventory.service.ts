import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { InventoryRepository } from '../repositories/inventory.repository';
import { inventoryListSchema, inventoryMovementsSchema, inventoryExitSchema, ingredientCreateSchema, ingredientUpdateSchema } from '../validators/inventory.validator';
import { AuthUser } from './auth.service';

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class AuthorizationError extends Error {
  constructor(message = 'No tienes permiso para realizar esta acción.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
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

class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

const EXIT_REASON_LABELS: Record<string, string> = {
  waste: 'Merma / Desperdicio',
  sample: 'Muestra / Degustación',
  internal_consumption: 'Consumo interno',
  donation: 'Donación',
  other: 'Otro',
};

export const InventoryService = {
  async search(query: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para buscar ingredientes.');
    }

    if (!query || query.trim().length < 2) {
      throw new ValidationError('La búsqueda debe tener al menos 2 caracteres.');
    }

    return InventoryRepository.searchByName(query.trim(), 20);
  },

  async findAll(query: z.infer<typeof inventoryListSchema>, user: AuthUser) {
    // Authorization: Only users with inventory permissions can view
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver el inventario.');
    }

    const { page, limit, search, status, isActive } = query;

    // Build where clause for filtering (status filtering done in memory)
    const where = {
      isActive: isActive !== undefined ? isActive : true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(status === 'out_of_stock' && {
        currentStock: { lte: 0 },
      }),
    };

    const result = await InventoryRepository.findWithPagination(page, limit, where);

    // Filter by status in memory
    if (status === 'low_stock') {
      result.data = result.data.filter(ing =>
        new Prisma.Decimal(ing.currentStock).gt(0) &&
        new Prisma.Decimal(ing.currentStock).lte(ing.minimumStock)
      );
    }

    return result;
  },

  async findOne(id: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver el inventario.');
    }

    const ingredient = await InventoryRepository.findById(id);

    if (!ingredient) {
      throw new NotFoundError('Ingrediente no encontrado.');
    }

    return ingredient;
  },

  async findBySku(sku: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver el inventario.');
    }

    const ingredient = await InventoryRepository.findBySku(sku);

    if (!ingredient) {
      throw new NotFoundError('Ingrediente con este SKU no encontrado.');
    }

    return ingredient;
  },

  async getMovements(query: z.infer<typeof inventoryMovementsSchema>, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver el historial de movimientos.');
    }

    const { page, limit, ingredientId, type, startDate, endDate, search } = query;

    // Validate ingredient exists if filtering by it
    if (ingredientId) {
      const ingredient = await InventoryRepository.findById(ingredientId);
      if (!ingredient) {
        throw new NotFoundError('Ingrediente no encontrado.');
      }
    }

    return InventoryRepository.findMovements(
      ingredientId,
      type,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      page,
      limit,
      search,
    );
  },

  async getLowStock(user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver el inventario.');
    }

    return InventoryRepository.findLowStock();
  },

  async getSummary(user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver el resumen del inventario.');
    }

    return InventoryRepository.getInventorySummary();
  },

  async getTotalValue(user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver el valor del inventario.');
    }

    return InventoryRepository.getTotalInventoryValue();
  },

  async createExit(data: z.infer<typeof inventoryExitSchema>, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.create_exit')) {
      throw new AuthorizationError('No tienes permiso para registrar salidas de inventario.');
    }

    return prisma.$transaction(async (tx) => {
      const ingredient = await InventoryRepository.findIngredientById(data.ingredientId, tx);
      if (!ingredient) throw new NotFoundError('Ingrediente no encontrado.');
      if (!ingredient.isActive) throw new ValidationError('El ingrediente está inactivo.');

      const quantity = new Prisma.Decimal(data.quantity);
      if (quantity.lte(0)) throw new ValidationError('La cantidad debe ser mayor a cero.');
      if (quantity.gt(ingredient.currentStock)) {
        throw new ValidationError(
          `Stock insuficiente. Disponible: ${ingredient.currentStock.toString()}`
        );
      }

      const updatedIngredient = await InventoryRepository.updateStock(data.ingredientId, quantity.negated(), tx);

      const movement = await InventoryRepository.createMovement(
        {
          ingredientId: data.ingredientId,
          type: 'exit',
          quantity: quantity.negated(),
          unitCost: ingredient.averageCost,
          referenceType: 'manual_exit',
          reason: data.reason,
          notes: data.notes,
          createdById: user.id,
        },
        tx,
      );

      return { ingredient: updatedIngredient, movement };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  async createIngredient(data: z.infer<typeof ingredientCreateSchema>, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.create_ingredient')) {
      throw new AuthorizationError('No tienes permiso para crear ingredientes.');
    }

    // Check for duplicate (exact match, case-insensitive)
    const existing = await InventoryRepository.findByNameNormalized(data.name.trim());
    if (existing) {
      throw new DuplicateError(
        'INGREDIENT',
        `Ya existe un ingrediente con el nombre "${existing.name}".`,
        existing.id
      );
    }

    return InventoryRepository.create({
      name: data.name,
      sku: data.sku,
      unitId: data.unitId,
      minimumStock: data.minimumStock ? new Prisma.Decimal(data.minimumStock) : undefined,
    });
  },

  async updateIngredient(id: string, data: z.infer<typeof ingredientUpdateSchema>, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.create_ingredient')) {
      throw new AuthorizationError('No tienes permiso para editar ingredientes.');
    }

    // Verify ingredient exists
    const ingredient = await InventoryRepository.findById(id);
    if (!ingredient) {
      throw new NotFoundError('Ingrediente no encontrado.');
    }

    // If name is being updated, check for duplicates
    if (data.name) {
      const normalized = data.name.trim();
      const existing = await InventoryRepository.findByNameNormalized(normalized);
      if (existing && existing.id !== id) {
        throw new DuplicateError(
          'INGREDIENT',
          `Ya existe otro ingrediente con el nombre "${existing.name}".`,
          existing.id
        );
      }
    }

    return InventoryRepository.update(id, {
      name: data.name,
      sku: data.sku,
      minimumStock: data.minimumStock ? new Prisma.Decimal(data.minimumStock) : undefined,
    });
  },

  async setIngredientActive(id: string, isActive: boolean, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.create_ingredient')) {
      throw new AuthorizationError('No tienes permiso para modificar ingredientes.');
    }

    // Verify ingredient exists
    const ingredient = await InventoryRepository.findById(id);
    if (!ingredient) {
      throw new NotFoundError('Ingrediente no encontrado.');
    }

    return InventoryRepository.setActive(id, isActive);
  },

  async deleteIngredient(id: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.delete_ingredient')) {
      throw new AuthorizationError('No tienes permiso para eliminar ingredientes.');
    }

    // Verify ingredient exists
    const ingredient = await InventoryRepository.findById(id);
    if (!ingredient) {
      throw new NotFoundError('Ingrediente no encontrado.');
    }

    // Check for related records
    const counts = await InventoryRepository.countRelations(id);
    const blockers: string[] = [];
    if (counts) {
      if (counts.movements > 0) blockers.push(`${counts.movements} movimiento(s) de inventario`);
      if (counts.purchaseItems > 0) blockers.push(`${counts.purchaseItems} compra(s)`);
      if (counts.recipes > 0) blockers.push(`${counts.recipes} receta(s) de producto`);
      if (counts.extraRecipes > 0) blockers.push(`${counts.extraRecipes} receta(s) de extra`);
      if (counts.countItems > 0) blockers.push(`${counts.countItems} conteo(s) físico(s)`);
    }

    if (blockers.length > 0) {
      throw new ConflictError(
        `No se puede eliminar: el ingrediente tiene ${blockers.join(', ')} registrados. Desactívalo en su lugar.`
      );
    }

    return InventoryRepository.delete(id);
  },

  async getUnits(user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver unidades de medida.');
    }

    return InventoryRepository.getAllUnits();
  },
};
