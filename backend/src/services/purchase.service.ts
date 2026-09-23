import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { runInTransaction } from '../repositories/transaction';
import { PurchaseRepository } from '../repositories/purchase.repository';
import { SupplierRepository } from '../repositories/supplier.repository';
import { InventoryRepository } from '../repositories/inventory.repository';
import { incomeStatementRepository } from '../repositories/income-statement.repository';
import { createPurchaseSchema } from '../validators/purchase.validator';
import { AuthUser } from './auth.service';
import { AuthorizationError, ConflictError, DuplicateError, NotFoundError, ValidationError } from '../utils/errors';
import { getZonedCalendarDate } from '../utils/businessDate';

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

    // Validate all ingredients exist. Compared against the unique ID count (not the raw
    // items length) because a purchase may legitimately list the same ingredient on more
    // than one line, and findIngredientsForPurchase returns one row per distinct ingredient.
    const ingredientIds = data.items.map(item => item.ingredientId);
    const uniqueIngredientIds = new Set(ingredientIds);
    const ingredients = await PurchaseRepository.findIngredientsForPurchase(ingredientIds);

    if (ingredients.length !== uniqueIngredientIds.size) {
      throw new ValidationError('Algunos ingredientes no existen.');
    }

    // Calculate totals
    let subtotal = new Prisma.Decimal(0);
    for (const item of data.items) {
      const qty = new Prisma.Decimal(item.quantity);
      const cost = new Prisma.Decimal(item.unitCost);
      subtotal = subtotal.add(qty.mul(cost));
    }

    const total = subtotal;

    // Generate invoice number: FAC-YYYY/MM/DD-NNNNN (with random suffix)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const randomSuffix = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const invoiceNumber = `FAC-${year}/${month}/${day}-${randomSuffix}`;

    // Create purchase with items
    const purchase = await PurchaseRepository.create({
      status: 'draft',
      invoiceNumber,
      supplier: data.supplierId ? { connect: { id: data.supplierId } } : undefined,
      notes: data.notes,
      subtotal,
      tax: new Prisma.Decimal(0),
      total,
      createdBy: { connect: { id: user.id } },
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
    });

    return purchase;
  },

  async receivePurchase(purchaseId: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.create_entry')) {
      throw new AuthorizationError('No tienes permiso para recibir compras.');
    }

    return runInTransaction(async (tx) => {
      // Fetch purchase
      const purchase = await PurchaseRepository.findByIdWithItems(purchaseId, tx);

      if (!purchase) {
        throw new NotFoundError('Compra no encontrada.');
      }

      if (purchase.status !== 'draft') {
        throw new ValidationError(`No se puede recibir una compra con estado: ${purchase.status}`);
      }

      if (purchase.items.length === 0) {
        throw new ValidationError('La compra no tiene items.');
      }

      // Process each item. Running stock/cost per ingredient is tracked locally
      // so that a purchase with the same ingredient on multiple lines computes
      // the weighted average against the value left by the previous line,
      // instead of against the stale snapshot fetched before the loop started.
      const inventoryMovements: Prisma.InventoryMovementCreateManyInput[] = [];
      const runningState = new Map<string, { stock: Prisma.Decimal; cost: Prisma.Decimal }>();

      for (const item of purchase.items) {
        const ingredient = item.ingredient;

        const previous = runningState.get(ingredient.id) ?? {
          stock: new Prisma.Decimal(ingredient.currentStock),
          cost: new Prisma.Decimal(ingredient.averageCost),
        };
        const newQuantity = new Prisma.Decimal(item.quantity);
        const newUnitCost = new Prisma.Decimal(item.unitCost);

        let newAverageCost: Prisma.Decimal;

        if (previous.stock.greaterThan(0)) {
          const oldValue = previous.stock.mul(previous.cost);
          const newValue = newQuantity.mul(newUnitCost);
          const totalValue = oldValue.add(newValue);
          const totalStock = previous.stock.add(newQuantity);
          newAverageCost = totalValue.div(totalStock);
        } else {
          newAverageCost = newUnitCost;
        }

        runningState.set(ingredient.id, {
          stock: previous.stock.add(newQuantity),
          cost: newAverageCost,
        });

        // Update ingredient stock and cost
        await InventoryRepository.updateStockAndCost(ingredient.id, item.quantity, newAverageCost, tx);

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
      await InventoryRepository.createMovements(inventoryMovements, tx);

      // Update purchase status
      const updatedPurchase = await PurchaseRepository.updateStatusAndReturn(purchaseId, 'received', tx);

      return updatedPurchase;
    }, { serializable: true }).then(async (updatedPurchase) => {
      // A newly-received purchase may now count as a variable expense (if made during business
      // hours) — invalidate any frozen snapshot for that day so it gets recalculated.
      const dateStr = getZonedCalendarDate(updatedPurchase.purchasedAt);
      await incomeStatementRepository.invalidateSnapshot(dateStr);
      return updatedPurchase;
    });
  },

  async deletePurchase(id: string, user: AuthUser) {
    // Authorization
    if (!user.permissions?.includes('inventory.create_entry')) {
      throw new AuthorizationError('No tienes permiso para eliminar compras.');
    }

    const purchase = await PurchaseRepository.findById(id);

    if (!purchase) {
      throw new NotFoundError('Compra no encontrada.');
    }

    if (purchase.status !== 'draft') {
      throw new ConflictError('Esta compra ya fue recibida y actualizó el inventario; no se puede eliminar.');
    }

    await PurchaseRepository.delete(id);
  },
};
