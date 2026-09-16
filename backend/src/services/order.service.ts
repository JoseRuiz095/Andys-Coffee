import { OrderStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  createOrderSchema,
  filterQuerySchema,
  updateOrderStatusSchema,
} from '../validators/order.validator';
import { prisma } from '../config/prisma';
import { OrderRepository } from '../repositories/order.repository';
import { UserRepository } from '../repositories/user.repository';
import { NotificationService } from './notification.service';
import { AuthUser } from './auth.service';
import { auditLog } from '../utils/logger';
import { calculateBestPromotion, type PricingPromotion } from './pricing.service';
import { AuthorizationError, NotFoundError, ValidationError } from '../utils/errors';
import { paginationMeta, paginationOffset } from '../utils/pagination';

// --- Custom Errors for Service Layer ---

class StateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateTransitionError';
  }
}

export async function getNextCustomerName(tx: Prisma.TransactionClient): Promise<string> {
  const [{ nextNumber }] = await tx.$queryRaw<{ nextNumber: bigint }[]>`
    SELECT nextval('customer_name_sequence') AS "nextNumber"
  `;
  return `Cliente ${nextNumber.toString()}`;
}

async function applyPromotions(
  orderItems: (Prisma.OrderItemGetPayload<{ include: { product: true } }>)[],
  promotions: (PricingPromotion & { products: { productId: string }[]; categories: { categoryId: string }[] })[],
) {
  return orderItems.flatMap((item) => {
    if (item.sourceComboId) return [];
    const applicable = promotions.filter((promotion) =>
      promotion.products.some((entry) => entry.productId === item.productId)
      || Boolean(item.product?.categoryId && promotion.categories.some((entry) => entry.categoryId === item.product?.categoryId)),
    );
    const pricing = calculateBestPromotion(item.unitPrice, item.quantity.toNumber(), applicable);
    return pricing.discount.gt(0) ? [{ orderItemId: item.id, amount: pricing.discount }] : [];
  });
}


// --- Main Service Logic ---

export const OrderService = {
  async findAll(query: z.infer<typeof filterQuerySchema>, user: AuthUser) {
    const { page, limit } = query;
    const skip = paginationOffset(page, limit);

    const where: Prisma.OrderWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { customerName: { contains: query.search, mode: 'insensitive' } },
          { id: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    // Authorization Check: Admins/Cashiers can see all orders, others only their own.
    if (!user.permissions?.includes('view:orders')) {
      where.createdById = user.id;
    }

    const { orders, total } = await OrderRepository.findWithPagination(where, skip, limit);

    return {
      data: orders,
      pagination: paginationMeta(page, limit, total),
    };
  },

  async findOne(id: string, user: AuthUser) {
    const order = await OrderRepository.findById(id);

    if (!order) {
      return null; // Not found
    }

    // Authorization Check: Allow if user owns the order or has general view permissions.
    if (order.createdById !== user.id && !user.permissions?.includes('view:orders')) {
      throw new AuthorizationError('No tienes permiso para acceder a este pedido.');
    }

    return order;
  },

  async updateStatus(id: string, data: z.infer<typeof updateOrderStatusSchema>, user: AuthUser, requestId?: string) {
    const { status } = data;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: true, cashSession: true },
    });
    if (!order) {
      throw new NotFoundError('Pedido no encontrado.');
    }

    if (order.createdById !== user.id && !user.permissions?.includes('view:orders')) {
      throw new AuthorizationError('No tienes permiso para modificar este pedido.');
    }

    if (!user.permissions?.includes('sales.cancel')) {
      throw new AuthorizationError('No tienes permiso para modificar este pedido.');
    }

    // State Machine Logic
    const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      [OrderStatus.pending]: [OrderStatus.completed, OrderStatus.cancelled],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      throw new StateTransitionError(`No se puede cambiar el estado de '${order.status}' a '${status}'.`);
    }

    const updateData: Prisma.OrderUpdateInput = { status };
    if (status === OrderStatus.completed || status === OrderStatus.cancelled) {
      updateData.completedAt = new Date();
    }

    return prisma.$transaction(async (tx) => {
      if (status === OrderStatus.cancelled && order.inventoryProcessed) {
        const inventoryMovements = await tx.inventoryMovement.findMany({
          where: { referenceType: 'order', referenceId: order.id, type: 'sale' },
        });

        for (const movement of inventoryMovements) {
          await tx.ingredient.update({
            where: { id: movement.ingredientId },
            data: { currentStock: { increment: movement.quantity.negated() } },
          });
          await tx.inventoryMovement.create({
            data: {
              ingredientId: movement.ingredientId,
              type: 'sale_reversal',
              quantity: movement.quantity.negated(),
              referenceType: 'order_cancellation',
              referenceId: order.id,
              createdById: user.id,
            },
          });
        }

        const saleMovements = await tx.cashMovement.findMany({
          where: { cashSessionId: order.cashSessionId ?? undefined, referenceType: 'order', referenceId: order.id, type: 'sale' },
        });
        for (const movement of saleMovements) {
          await tx.cashMovement.create({
            data: {
              cashSessionId: movement.cashSessionId,
              type: 'sale_reversal',
              amount: movement.amount.negated(),
              referenceType: 'order_cancellation',
              referenceId: order.id,
              description: `Cancelación de venta #${order.orderNumber.toString()}`,
              createdById: user.id,
            },
          });
          await tx.cashSession.update({
            where: { id: movement.cashSessionId },
            data: { expectedAmount: { decrement: movement.amount } },
          });
        }

        await tx.payment.updateMany({
          where: { orderId: order.id, status: 'paid' },
          data: { status: 'cancelled' },
        });
        updateData.inventoryProcessed = false;
      }

      const updatedOrder = await tx.order.update({
        where: { id },
        data: updateData,
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'ORDER_STATUS_CHANGED',
          metadata: {
            orderId: id,
            previousStatus: order.status,
            newStatus: status,
          },
        },
      });
      auditLog({
        requestId,
        actor: { id: user.id, name: user.name },
        action: 'ORDER_STATUS_CHANGED',
        entity: 'order',
        entityId: id,
        previousState: order.status,
        newState: status,
      }, 'Order status changed');
      return updatedOrder;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  async create(orderData: CreateOrderInput, userId: string, idempotencyKey: string, attempt = 0, requestId?: string): Promise<Prisma.OrderGetPayload<{ include: { items: { include: { extras: true } } } }>> {
    const { items, paymentMethod, cashSessionId, cashReceived, ...restOfOrder } = orderData;
    const today = new Date();
    const currentDay = today.getDay();

    const productIds = items.map(item => item.productId).filter(Boolean) as string[];
    const comboIds = items.map(item => item.comboId).filter(Boolean) as string[];
    const extraIds = items.flatMap(item => item.extras?.map(e => e.extraId) || []).filter(Boolean);

    try {
      const result = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: { createdById: userId, idempotencyKey },
        include: { items: { include: { extras: true } }, payments: true },
      });
      if (existingOrder) return { order: existingOrder, wasCreated: false as const };

      // Product/combo/extra/promotion data is read inside the transaction (not before it)
      // so Serializable isolation covers price/isActive against concurrent changes: a price
      // update or deactivation committed after this point conflicts here instead of silently
      // producing an order built from stale data.
      const [dbProducts, dbCombosWithItems, dbExtras, productExtras, activePromotions] = await Promise.all([
        tx.product.findMany({
          where: { id: { in: productIds }, isActive: true },
          select: { id: true, name: true, categoryId: true, price: true, cost: true },
        }),
        tx.combo.findMany({
          where: {
            id: { in: comboIds },
            isActive: true,
            items: { every: { product: { isActive: true } } },
            OR: [{ activeOnDays: { isEmpty: true } }, { activeOnDays: { has: currentDay } }],
          },
          include: {
            items: {
              select: {
                productId: true,
                quantity: true,
                product: { select: { id: true, name: true, cost: true, isActive: true } },
              },
            },
          },
        }),
        tx.extra.findMany({
          where: { id: { in: extraIds }, isActive: true },
          select: { id: true, name: true, price: true, cost: true },
        }),
        tx.productExtra.findMany({
          where: {
            OR: productIds.flatMap((productId) => extraIds.map((extraId) => ({ productId, extraId }))),
          },
        }),
        tx.promotion.findMany({
          where: {
            isActive: true,
            startDate: { lte: today },
            endDate: { gte: today },
            OR: [{ activeOnDays: { isEmpty: true } }, { activeOnDays: { has: currentDay } }],
          },
          select: {
            id: true,
            type: true,
            discountValue: true,
            buyQuantity: true,
            getQuantity: true,
            products: { select: { productId: true } },
            categories: { select: { categoryId: true } },
          },
        }),
      ]);

      const productsMap = new Map(dbProducts.map(p => [p.id, p]));
      const combosMap = new Map(dbCombosWithItems.map(c => [c.id, c]));
      const extrasMap = new Map(dbExtras.map(e => [e.id, e]));

      if (productIds.some((id) => !productsMap.has(id))) {
        throw new ValidationError('Uno o más productos no existen o están inactivos.');
      }
      if (comboIds.some((id) => !combosMap.has(id))) {
        throw new ValidationError('Uno o más combos no existen, están inactivos o no están disponibles hoy.');
      }
      if (extraIds.some((id) => !extrasMap.has(id))) {
        throw new ValidationError('Uno o más extras no existen o están inactivos.');
      }
      const validProductExtras = new Set(productExtras.map(({ productId, extraId }) => `${productId}:${extraId}`));
      for (const item of items) {
        if (!item.productId) continue;
        for (const extra of item.extras ?? []) {
          if (!validProductExtras.has(`${item.productId}:${extra.extraId}`)) {
            throw new ValidationError(`El extra ${extra.extraId} no pertenece al producto ${item.productId}.`);
          }
        }
      }

      const openCashSession = await tx.cashSession.findFirst({
        where: { status: 'open', ...(cashSessionId ? { id: cashSessionId } : {}) },
        orderBy: { openedAt: 'desc' },
      });
      if (!openCashSession) {
        const error = new Error('No hay una caja abierta para registrar la venta.');
        error.name = 'BusinessRuleError';
        throw error;
      }

      let totalOrderCost = new Prisma.Decimal(0);
      let subtotal = new Prisma.Decimal(0);

      // Handle customer name generation
      let finalCustomerName = restOfOrder.customerName;
      if (!finalCustomerName || finalCustomerName.trim().toLowerCase() === 'cliente') {
        finalCustomerName = await getNextCustomerName(tx);
      }

      const order = await tx.order.create({
        data: {
          customerName: finalCustomerName,
          notes: restOfOrder.notes,
          status: 'pending',
          createdById: userId,
          cashSessionId: openCashSession.id,
          idempotencyKey,
        },
      });

      const createdOrderItems: Prisma.OrderItemGetPayload<{ include: { product: true } }>[] = [];

      for (const item of items) {
        if (item.productId) {
          const product = productsMap.get(item.productId);
          if (!product) throw new ValidationError(`Producto con ID ${item.productId} no encontrado o inactivo.`);
          const itemSubtotal = product.price.mul(item.quantity);
          const itemCost = product.cost.mul(item.quantity);
          subtotal = subtotal.add(itemSubtotal);
          totalOrderCost = totalOrderCost.add(itemCost);
          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: product.id,
              productName: product.name,
              quantity: item.quantity,
              unitPrice: product.price,
              subtotal: itemSubtotal,
              costSnapshot: itemCost,
              notes: item.note,
              extras: {
                create: (item.extras ?? []).map((extraData) => {
                  const extra = extrasMap.get(extraData.extraId);
                  if (!extra) throw new ValidationError(`Extra con ID ${extraData.extraId} no encontrado o inactivo.`);
                  const extraSubtotal = extra.price.mul(extraData.quantity);
                  return {
                    extraId: extra.id,
                    extraName: extra.name,
                    quantity: extraData.quantity,
                    unitPrice: extra.price,
                    subtotal: extraSubtotal,
                    costSnapshot: extra.cost,
                  };
                }),
              },
            },
            include: { product: true },
          });
          createdOrderItems.push(orderItem);
          for (const extraData of item.extras ?? []) {
            const extra = extrasMap.get(extraData.extraId);
            if (!extra) throw new ValidationError(`Extra con ID ${extraData.extraId} no encontrado o inactivo.`);
            const extraSubtotal = extra.price.mul(extraData.quantity);
            subtotal = subtotal.add(extraSubtotal);
            totalOrderCost = totalOrderCost.add(extra.cost.mul(extraData.quantity));
          }
        } else if (item.comboId) {
          const combo = combosMap.get(item.comboId);
          if (!combo) throw new ValidationError(`Combo con ID ${item.comboId} no encontrado o no está activo para hoy.`);
          subtotal = subtotal.add(combo.price.mul(item.quantity));
          for (const comboItem of combo.items) {
            const quantity = comboItem.quantity.mul(item.quantity);
            const itemCost = comboItem.product.cost.mul(quantity);
            totalOrderCost = totalOrderCost.add(itemCost);
            createdOrderItems.push(await tx.orderItem.create({
              data: { orderId: order.id, productId: comboItem.productId, productName: `${comboItem.product.name} (Combo: ${combo.name})`, quantity, unitPrice: 0, subtotal: 0, costSnapshot: itemCost, sourceComboId: combo.id, notes: item.note },
              include: { product: true },
            }));
          }
        }
      }

      const itemDiscounts = await applyPromotions(createdOrderItems, activePromotions);
      let totalDiscount = new Prisma.Decimal(0);
      for (const discount of itemDiscounts) {
        totalDiscount = totalDiscount.add(discount.amount);
        await tx.orderItem.update({ where: { id: discount.orderItemId }, data: { discount: discount.amount, subtotal: { decrement: discount.amount } } });
      }
      const finalTotal = Prisma.Decimal.max(new Prisma.Decimal(0), subtotal.sub(totalDiscount));
      const isCashPayment = paymentMethod === 'cash';
      const receivedAmount = isCashPayment
        ? new Prisma.Decimal(cashReceived ?? 0)
        : null;
      if (isCashPayment && (!receivedAmount || receivedAmount.lt(finalTotal))) {
        const error = new Error('El monto recibido debe cubrir el total de la venta.');
        error.name = 'BusinessRuleError';
        throw error;
      }
      const changeAmount = receivedAmount ? receivedAmount.sub(finalTotal) : null;

      const productQuantities = new Map<string, Prisma.Decimal>();
      for (const item of createdOrderItems) {
        productQuantities.set(item.productId, (productQuantities.get(item.productId) ?? new Prisma.Decimal(0)).add(item.quantity));
      }
      const [recipes, extraRecipes] = await Promise.all([
        tx.recipe.findMany({ where: { productId: { in: Array.from(productQuantities.keys()) } } }),
        tx.extraRecipe.findMany({ where: { extraId: { in: extraIds } } }),
      ]);
      const ingredientRequirements = new Map<string, Prisma.Decimal>();
      for (const recipe of recipes) {
        const productQuantity = productQuantities.get(recipe.productId) ?? new Prisma.Decimal(0);
        ingredientRequirements.set(recipe.ingredientId, (ingredientRequirements.get(recipe.ingredientId) ?? new Prisma.Decimal(0)).add(recipe.quantity.mul(productQuantity)));
      }
      for (const item of items) {
        for (const extra of item.extras ?? []) {
          for (const recipe of extraRecipes.filter((entry) => entry.extraId === extra.extraId)) {
            ingredientRequirements.set(recipe.ingredientId, (ingredientRequirements.get(recipe.ingredientId) ?? new Prisma.Decimal(0)).add(recipe.quantity.mul(extra.quantity)));
          }
        }
      }
      const inventoryMovements: Prisma.InventoryMovementCreateManyInput[] = [];
      for (const [ingredientId, quantity] of ingredientRequirements) {
        const updated = await tx.ingredient.updateMany({
          where: { id: ingredientId, isActive: true, currentStock: { gte: quantity } },
          data: { currentStock: { decrement: quantity } },
        });
        if (updated.count !== 1) {
          const error = new Error('Stock insuficiente para completar la venta.');
          error.name = 'BusinessRuleError';
          throw error;
        }
        inventoryMovements.push({
          ingredientId,
          type: 'sale',
          quantity: quantity.negated(),
          referenceType: 'order',
          referenceId: order.id,
          createdById: userId,
        });
      }
      if (inventoryMovements.length > 0) {
        await tx.inventoryMovement.createMany({ data: inventoryMovements });
      }

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { subtotal, discount: totalDiscount, total: finalTotal, totalCost: totalOrderCost, inventoryProcessed: true },
        include: { items: { include: { extras: true } } },
      });
      await tx.payment.create({ data: { orderId: order.id, method: paymentMethod, amount: finalTotal, createdById: userId } });
      if (isCashPayment) {
        await tx.cashMovement.create({
          data: {
            cashSessionId: openCashSession.id,
            type: 'sale',
            amount: finalTotal,
            receivedAmount,
            changeAmount,
            referenceType: 'order',
            referenceId: order.id,
            description: `Venta #${order.orderNumber.toString()}`,
            createdById: userId,
          },
        });
        await tx.cashSession.update({
          where: { id: openCashSession.id },
          data: { expectedAmount: { increment: finalTotal } },
        });
      }

      auditLog({
        requestId,
        actor: { id: userId },
        action: 'ORDER_CREATED',
        entity: 'order',
        entityId: updatedOrder.id,
        amount: finalTotal.toFixed(2),
      }, 'Order created');

        return { order: updatedOrder, wasCreated: true as const };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      // Notifications are dispatched after the transaction commits (not inside it) so
      // that writing to an unrelated NotificationRecipient row can't contribute to a
      // serialization conflict on the sales transaction, and only for a freshly created
      // order (not an idempotent replay of an already-committed one).
      if (result.wasCreated) {
        const usersToNotify = await UserRepository.findActiveByRoleNames(['ADMIN', 'CAJERO']);

        if (usersToNotify.length > 0) {
          await NotificationService.createNotification(
            {
              title: 'Nuevo Pedido',
              message: `Se ha creado un nuevo pedido: #${result.order.orderNumber.toString()} por ${result.order.customerName}.`,
              type: 'NEW_ORDER',
              referenceId: result.order.id,
            },
            usersToNotify.map((user) => user.id),
          );
        }
      }

      return result.order;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) {
        return OrderService.create(orderData, userId, idempotencyKey, attempt + 1, requestId);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        for (let lookupAttempt = 0; lookupAttempt < 3; lookupAttempt += 1) {
          const existingOrder = await prisma.order.findFirst({
            where: { createdById: userId, idempotencyKey },
            include: { items: { include: { extras: true } }, payments: true },
          });
          if (existingOrder) return existingOrder;
        }
      }
      throw error;
    }
  }
};

type CreateOrderInput = z.infer<typeof createOrderSchema>;
