import { OrderStatus, Prisma, PromotionType } from '@prisma/client';
import { z } from 'zod';
import {
  createOrderSchema,
  filterQuerySchema,
  updateOrderStatusSchema,
} from '../validators/order.validator';
import { prisma } from '../config/prisma';
import { NotificationService } from './notification.service';
import { AuthUser } from './auth.service';
import { logger } from '../utils/logger';

// --- Custom Errors for Service Layer ---

class AuthorizationError extends Error {
  constructor(message = 'El usuario no tiene permiso para realizar esta acción.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

class StateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateTransitionError';
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

async function applyPromotions(
  orderItems: (Prisma.OrderItemGetPayload<{ include: { product: true } }>)[],
  promotions: (Prisma.PromotionGetPayload<{ include: { products: true; categories: true } }>)[],
) {
  const discounts: { orderItemId: string; amount: Prisma.Decimal }[] = [];
  const processedQuantities = new Map<string, number>();

  for (const promotion of promotions) {
    const eligibleItems = orderItems.filter((item) => {
      if (item.sourceComboId) return false;
      return promotion.products.some((entry) => entry.productId === item.productId)
        || Boolean(item.product?.categoryId && promotion.categories.some(
          (entry) => entry.categoryId === item.product?.categoryId,
        ));
    });
    const availableItems = eligibleItems.flatMap((item) => {
      const processed = processedQuantities.get(item.id) ?? 0;
      const available = Math.max(0, item.quantity.toNumber() - processed);
      return Array.from({ length: available }, () => item);
    });
    availableItems.sort((left, right) => right.unitPrice.comparedTo(left.unitPrice));

    if (promotion.type === PromotionType.FIXED_PRICE) {
      for (const item of availableItems) {
        if (item.unitPrice.gt(promotion.discountValue)) {
          discounts.push({ orderItemId: item.id, amount: item.unitPrice.sub(promotion.discountValue) });
          processedQuantities.set(item.id, (processedQuantities.get(item.id) ?? 0) + 1);
        }
      }
    }

    if (promotion.type === PromotionType.BOGO || promotion.type === PromotionType.MULTIBUY_FIXED_PRICE) {
      const buyQuantity = promotion.buyQuantity ?? 1;
      const getQuantity = promotion.type === PromotionType.BOGO ? (promotion.getQuantity ?? 1) : 0;
      const groupSize = promotion.type === PromotionType.BOGO ? buyQuantity + getQuantity : buyQuantity;
      if (groupSize <= 0) continue;
      while (availableItems.length >= groupSize) {
        const group = availableItems.splice(0, groupSize);
        group.forEach((item) => processedQuantities.set(item.id, (processedQuantities.get(item.id) ?? 0) + 1));
        if (promotion.type === PromotionType.BOGO) {
          for (const item of group.slice(-getQuantity)) {
            discounts.push({ orderItemId: item.id, amount: item.unitPrice.mul(promotion.discountValue).div(100) });
          }
        } else {
          const groupPrice = group.reduce((sum, item) => sum.add(item.unitPrice), new Prisma.Decimal(0));
          if (groupPrice.gt(promotion.discountValue)) {
            discounts.push({ orderItemId: group[group.length - 1].id, amount: groupPrice.sub(promotion.discountValue) });
          }
        }
      }
    }
  }

  const aggregated = new Map<string, Prisma.Decimal>();
  for (const discount of discounts) {
    aggregated.set(discount.orderItemId, (aggregated.get(discount.orderItemId) ?? new Prisma.Decimal(0)).add(discount.amount));
  }
  return Array.from(aggregated, ([orderItemId, amount]) => ({ orderItemId, amount }));
}


// --- Main Service Logic ---

export const OrderService = {
  async findAll(query: z.infer<typeof filterQuerySchema>, user: AuthUser) {
    const page = parseInt(query.page);
    const limit = parseInt(query.limit);
    const skip = (page - 1) * limit;

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

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          items: {
            include: {
              extras: true,
            }
          },
          payments: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findOne(id: string, user: AuthUser) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            extras: true,
            product: true
          }
        },
        payments: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          }
        }
      },
    });

    if (!order) {
      return null; // Not found
    }

    // Authorization Check: Allow if user owns the order or has general view permissions.
    if (order.createdById !== user.id && !user.permissions?.includes('view:orders')) {
      throw new AuthorizationError('No tienes permiso para acceder a este pedido.');
    }

    return order;
  },

  async updateStatus(id: string, data: z.infer<typeof updateOrderStatusSchema>, user: AuthUser) {
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
      logger.info({
        actor: { id: user.id, name: user.name },
        orderId: id,
        previousStatus: order.status,
        newStatus: status,
      }, 'Order status changed');
      return updatedOrder;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  async create(orderData: CreateOrderInput, userId: string, idempotencyKey: string, attempt = 0): Promise<Prisma.OrderGetPayload<{ include: { items: { include: { extras: true } } } }>> {
    const { items, paymentMethod, cashSessionId, cashReceived, ...restOfOrder } = orderData;
    const today = new Date();
    const currentDay = today.getDay();

    const productIds = items.map(item => item.productId).filter(Boolean) as string[];
    const comboIds = items.map(item => item.comboId).filter(Boolean) as string[];
    const extraIds = items.flatMap(item => item.extras?.map(e => e.extraId) || []).filter(Boolean);

    const [dbProducts, dbCombosWithItems, dbExtras, activePromotions] = await Promise.all([
      prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } }),
      prisma.combo.findMany({
        where: {
          id: { in: comboIds },
          isActive: true,
          items: { every: { product: { isActive: true } } },
          OR: [{ activeOnDays: { isEmpty: true } }, { activeOnDays: { has: currentDay } }],
        },
        include: { items: { include: { product: true } } },
      }),
      prisma.extra.findMany({ where: { id: { in: extraIds }, isActive: true } }),
      prisma.promotion.findMany({
        where: {
          isActive: true,
          startDate: { lte: today },
          endDate: { gte: today },
          OR: [{ activeOnDays: { isEmpty: true } }, { activeOnDays: { has: currentDay } }],
        },
        include: { products: true, categories: true },
      }),
    ]);

    const productsMap = new Map(dbProducts.map(p => [p.id, p]));
    const combosMap = new Map(dbCombosWithItems.map(c => [c.id, c]));
    const extrasMap = new Map(dbExtras.map(e => [e.id, e]));

    try {
      return await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: { createdById: userId, idempotencyKey },
        include: { items: { include: { extras: true } }, payments: true },
      });
      if (existingOrder) return existingOrder;

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
        const lastCustomerOrder = await tx.order.findFirst({
          where: { customerName: { startsWith: 'Cliente ' } },
          orderBy: { createdAt: 'desc' },
        });

        let nextCustomerNumber = 1;
        if (lastCustomerOrder?.customerName) {
          const match = lastCustomerOrder.customerName.match(/^Cliente (\d+)$/);
          if (match) {
            nextCustomerNumber = parseInt(match[1], 10) + 1;
          }
        }
        finalCustomerName = `Cliente ${nextCustomerNumber}`;
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
          if (!product) throw new Error(`Producto con ID ${item.productId} no encontrado o inactivo.`);
          const itemSubtotal = product.price.mul(item.quantity);
          const itemCost = product.cost.mul(item.quantity);
          subtotal = subtotal.add(itemSubtotal);
          totalOrderCost = totalOrderCost.add(itemCost);
          const orderItem = await tx.orderItem.create({
            data: { orderId: order.id, productId: product.id, productName: product.name, quantity: item.quantity, unitPrice: product.price, subtotal: itemSubtotal, costSnapshot: itemCost, notes: item.note },
            include: { product: true },
          });
          createdOrderItems.push(orderItem);
          for (const extraData of item.extras ?? []) {
            const extra = extrasMap.get(extraData.extraId);
            if (!extra) throw new Error(`Extra con ID ${extraData.extraId} no encontrado o inactivo.`);
            const relation = await tx.productExtra.findUnique({ where: { productId_extraId: { productId: product.id, extraId: extra.id } } });
            if (!relation) throw new Error(`El extra ${extra.id} no pertenece al producto ${product.id}.`);
            const extraSubtotal = extra.price.mul(extraData.quantity);
            subtotal = subtotal.add(extraSubtotal);
            totalOrderCost = totalOrderCost.add(extra.cost.mul(extraData.quantity));
            await tx.orderItemExtra.create({ data: { orderItemId: orderItem.id, extraId: extra.id, extraName: extra.name, quantity: extraData.quantity, unitPrice: extra.price, subtotal: extraSubtotal, costSnapshot: extra.cost } });
          }
        } else if (item.comboId) {
          const combo = combosMap.get(item.comboId);
          if (!combo) throw new Error(`Combo con ID ${item.comboId} no encontrado o no está activo para hoy.`);
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
      const isCashPayment = paymentMethod === 'Efectivo' || paymentMethod === 'cash';
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
        await tx.inventoryMovement.create({
          data: {
            ingredientId,
            type: 'sale',
            quantity: quantity.negated(),
            referenceType: 'order',
            referenceId: order.id,
            createdById: userId,
          },
        });
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

      // Notify relevant users
      const usersToNotify = await tx.user.findMany({
        where: {
          isActive: true,
          role: {
            name: {
              in: ['ADMIN', 'CAJERO'],
              mode: 'insensitive',
            },
          },
        },
        select: { id: true },
      });

      if (usersToNotify.length > 0) {
        await NotificationService.createNotification(
          {
            title: 'Nuevo Pedido',
            message: `Se ha creado un nuevo pedido: #${order.orderNumber.toString()} por ${finalCustomerName}.`,
            type: 'NEW_ORDER',
            referenceId: updatedOrder.id,
          },
          usersToNotify.map((user) => user.id),
          tx
        );
      }

        return updatedOrder;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) {
        return OrderService.create(orderData, userId, idempotencyKey, attempt + 1);
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
