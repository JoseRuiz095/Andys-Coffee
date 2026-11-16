import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { runInTransaction } from '../repositories/transaction';
import { InventoryRepository } from '../repositories/inventory.repository';
import { inventoryListSchema, inventoryMovementsSchema, inventoryExitSchema, ingredientCreateSchema, ingredientUpdateSchema } from '../validators/inventory.validator';
import { AuthUser } from './auth.service';
import { AuthorizationError, ConflictError, DuplicateError, NotFoundError, ValidationError } from '../utils/errors';
import { auditLog } from '../utils/logger';
import { crossedThreshold, type StockCrossing } from './inventory-consumption.service';
import { StockAlertService } from './stock-alert.service';

export const INGREDIENT_SKU_PREFIX = 'INS-';

/** Next INS-### SKU after the highest one in use (INS-001 when there is none). */
export function nextIngredientSku(existingSkus: string[]) {
  const highest = existingSkus.reduce((max, sku) => {
    const match = /^INS-(\d+)$/.exec(sku);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${INGREDIENT_SKU_PREFIX}${String(highest + 1).padStart(3, '0')}`;
}

function ensureMaximumNotBelowMinimum(minimum: string, maximum: string | null | undefined) {
  if (maximum === null || maximum === undefined) return;
  if (new Prisma.Decimal(maximum).lt(minimum)) {
    throw new ValidationError('El stock máximo no puede ser menor que el stock mínimo.');
  }
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

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

    const where = {
      isActive: isActive !== undefined ? isActive : true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    // The stock status is filtered in the query, so every page comes back full.
    return InventoryRepository.findWithPagination(page, limit, where, status);
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

    const { page, limit, ingredientId, type, startDate, endDate, search, orderId } = query;

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
      orderId,
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

  async createExit(data: z.infer<typeof inventoryExitSchema>, user: AuthUser, idempotencyKey?: string) {
    // Authorization
    if (!user.permissions?.includes('inventory.create_exit')) {
      throw new AuthorizationError('No tienes permiso para registrar salidas de inventario.');
    }

    let crossings: StockCrossing[] = [];
    const result = await runInTransaction(async (tx) => {
      if (idempotencyKey) {
        const existingMovement = await InventoryRepository.findMovementByIdempotencyKey(user.id, idempotencyKey, tx);
        if (existingMovement) {
          const ingredient = await InventoryRepository.findIngredientById(existingMovement.ingredientId, tx);
          return { ingredient, movement: existingMovement };
        }
      }

      const ingredient = await InventoryRepository.findIngredientById(data.ingredientId, tx);
      if (!ingredient) throw new NotFoundError('Ingrediente no encontrado.');
      if (!ingredient.isActive) throw new ValidationError('El ingrediente está inactivo.');

      const quantity = new Prisma.Decimal(data.quantity);
      if (quantity.lte(0)) throw new ValidationError('La cantidad debe ser mayor a cero.');
      // INV-6 (2026-11-14): stock may go negative (decision D-1 of the real-time inventory
      // plan: sales never block). A real waste must be recordable even then; the count fixes it.

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
          idempotencyKey,
          balanceAfter: updatedIngredient.currentStock,
        },
        tx,
      );

      if (crossedThreshold(ingredient.currentStock, updatedIngredient.currentStock, updatedIngredient.minimumStock)) {
        crossings = [{
          ingredientId: updatedIngredient.id,
          name: updatedIngredient.name,
          unit: updatedIngredient.unit.abbreviation,
          before: ingredient.currentStock,
          after: updatedIngredient.currentStock,
          minimumStock: updatedIngredient.minimumStock,
        }];
      }
      return { ingredient: updatedIngredient, movement };
    }, { serializable: true });

    // After the commit: alert if the exit took the ingredient to its minimum or ran it out.
    await StockAlertService.notify(crossings);
    return result;
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

    // Stock and recipes are kept in the base unit of each dimension (gr, ml, pz); kg and lt
    // only convert what is captured.
    const unit = await InventoryRepository.findUnitById(data.unitId);
    if (!unit) throw new ValidationError('La unidad de medida no existe.');
    if (!unit.factor.eq(1)) {
      throw new ValidationError(
        `Los insumos se guardan en unidad base (gramos, mililitros o piezas), no en ${unit.name}.`,
      );
    }
    ensureMaximumNotBelowMinimum(data.minimumStock ?? '0', data.maximumStock);

    const base = {
      name: data.name,
      unitId: data.unitId,
      minimumStock: data.minimumStock ? new Prisma.Decimal(data.minimumStock) : undefined,
      maximumStock: data.maximumStock === undefined || data.maximumStock === null ? null : new Prisma.Decimal(data.maximumStock),
    };
    if (data.sku) {
      try {
        return await InventoryRepository.create({ ...base, sku: data.sku });
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError(`Ya existe un ingrediente con el SKU "${data.sku}".`);
        throw error;
      }
    }

    // INS-### numbering; a concurrent create taking the same number retries with the next one.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const sku = nextIngredientSku(await InventoryRepository.findLastSkuWithPrefix(INGREDIENT_SKU_PREFIX));
      try {
        return await InventoryRepository.create({ ...base, sku });
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 2) throw error;
      }
    }
    throw new ConflictError('No se pudo asignar un SKU al ingrediente. Intenta de nuevo.');
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

    ensureMaximumNotBelowMinimum(
      data.minimumStock ?? ingredient.minimumStock.toString(),
      data.maximumStock === undefined ? ingredient.maximumStock?.toString() ?? null : data.maximumStock,
    );

    try {
      return await InventoryRepository.update(id, {
        name: data.name,
        sku: data.sku,
        minimumStock: data.minimumStock !== undefined ? new Prisma.Decimal(data.minimumStock) : undefined,
        maximumStock: data.maximumStock === undefined ? undefined
          : data.maximumStock === null ? null : new Prisma.Decimal(data.maximumStock),
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError(`Ya existe un ingrediente con el SKU "${data.sku}".`);
      throw error;
    }
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

    // A sale must find every ingredient of its recipe: deactivate only unused ingredients.
    if (!isActive) {
      const usedBy = await InventoryRepository.findActiveRecipeUsage(id);
      if (usedBy.length > 0) {
        throw new ConflictError(
          `No se puede desactivar "${ingredient.name}": lo usan las recetas de ${usedBy.join(', ')}. ` +
          'Quítalo de esas recetas primero.',
        );
      }
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

    const deleted = await InventoryRepository.delete(id);

    // Audit log for ingredient deletion
    auditLog(
      {
        actor: { id: user.id, name: user.name, role: user.roleName },
        action: 'INGREDIENT_DELETED',
        entity: 'ingredient',
        entityId: id,
        metadata: {
          name: ingredient.name,
          sku: ingredient.sku,
        },
      },
      `Ingrediente eliminado: ${ingredient.name} (${ingredient.sku})`
    );

    return deleted;
  },

  async getUnits(user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver unidades de medida.');
    }

    return InventoryRepository.getAllUnits();
  },
};
