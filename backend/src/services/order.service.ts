import { OrderStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  createOrderSchema,
  filterQuerySchema,
  updateOrderStatusSchema,
  updateOrderSchema,
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
import { getZonedDayBoundaries, getTodayInZone } from '../utils/businessDate';

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
  promotions: PricingPromotion[],
) {
  // Nota: Relaciones PromotionOnProduct/PromotionOnCategory fueron eliminadas (código muerto)
  // Ahora se aplican todas las promociones globales a todos los productos
  return orderItems.flatMap((item) => {
    if (item.sourceComboId) return [];
    const pricing = calculateBestPromotion(item.unitPrice, item.quantity.toNumber(), promotions);
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
    if (!user.permissions?.includes('sales.read')) {
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
    if (order.createdById !== user.id && !user.permissions?.includes('sales.read')) {
      throw new AuthorizationError('No tienes permiso para acceder a este pedido.');
    }

    return order;
  },

  async updateStatus(id: string, data: z.infer<typeof updateOrderStatusSchema>, user: AuthUser, requestId?: string) {
    const { status, reason } = data;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: true, cashSession: true },
    });
    if (!order) {
      throw new NotFoundError('Pedido no encontrado.');
    }

    // Authorization: can view this order
    if (order.createdById !== user.id && !user.permissions?.includes('sales.read')) {
      throw new AuthorizationError('No tienes permiso para modificar este pedido.');
    }

    // Authorization: can advance order status (preparing, ready, completed)
    if (status !== OrderStatus.cancelled && !user.permissions?.includes('sales.create')) {
      throw new AuthorizationError('No tienes permiso para avanzar el estado de este pedido.');
    }

    // Authorization: can cancel orders
    if (status === OrderStatus.cancelled && !user.permissions?.includes('sales.cancel')) {
      throw new AuthorizationError('No tienes permiso para cancelar este pedido.');
    }

    // State Machine Logic: pending → preparing → ready → completed (or cancelled from any state)
    const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      [OrderStatus.pending]: [OrderStatus.preparing, OrderStatus.cancelled],
      [OrderStatus.preparing]: [OrderStatus.ready, OrderStatus.cancelled],
      [OrderStatus.ready]: [OrderStatus.completed, OrderStatus.cancelled],
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

        // Mandadito reversal — a cancelled sale can't leave third-party delivery cash or an
        // auto-generated delivery expense still affecting the drawer / Gastos Variables.
        if (order.hasDelivery && order.deliveryResponsible === 'customer_to_business' && !order.deliveryHandedOff) {
          const collectedMovement = await tx.cashMovement.findFirst({
            where: { referenceType: 'order', referenceId: order.id, type: 'delivery_collected' },
          });
          if (collectedMovement) {
            await tx.cashMovement.create({
              data: {
                cashSessionId: collectedMovement.cashSessionId,
                type: 'delivery_collected_reversal',
                amount: collectedMovement.amount.negated(),
                referenceType: 'order_cancellation',
                referenceId: order.id,
                description: `Cancelación de mandadito — Venta #${order.orderNumber.toString()}`,
                createdById: user.id,
              },
            });
            await tx.cashSession.update({
              where: { id: collectedMovement.cashSessionId },
              data: { expectedAmount: { decrement: collectedMovement.amount } },
            });
          }
        }

        if (order.hasDelivery && order.deliveryResponsible === 'business_absorbs') {
          const deliveryExpense = await tx.expense.findFirst({ where: { sourceOrderId: order.id } });
          if (deliveryExpense) {
            const expenseMovement = await tx.cashMovement.findFirst({
              where: { referenceType: 'expense', referenceId: deliveryExpense.id, type: 'expense' },
            });
            if (expenseMovement) {
              await tx.cashMovement.create({
                data: {
                  cashSessionId: expenseMovement.cashSessionId,
                  type: 'expense_reversal',
                  amount: expenseMovement.amount.negated(),
                  referenceType: 'order_cancellation',
                  referenceId: order.id,
                  description: `Cancelación de mandadito absorbido — Venta #${order.orderNumber.toString()}`,
                  createdById: user.id,
                },
              });
              await tx.cashSession.update({
                where: { id: expenseMovement.cashSessionId },
                data: { expectedAmount: { increment: expenseMovement.amount } },
              });
            }
            // The expense was auto-generated by this sale — remove it so it stops
            // counting in Gastos Variables now that the sale no longer exists.
            await tx.expense.delete({ where: { id: deliveryExpense.id } });
          }
        }

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
            ...(reason && { reason }),
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
    const { items, paymentMethod, cashSessionId, cashReceived, hasDelivery, deliveryAmount, deliveryResponsible, deliveryPaymentMethod, ...restOfOrder } = orderData;
    const today = getTodayInZone();
    const todayDate = new Date(today + ' 00:00:00');
    const currentDay = todayDate.getDay();

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
            startDate: { lte: todayDate },
            endDate: { gte: todayDate },
            OR: [{ activeOnDays: { isEmpty: true } }, { activeOnDays: { has: currentDay } }],
          },
          select: {
            id: true,
            type: true,
            discountValue: true,
            buyQuantity: true,
            getQuantity: true,
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
          const comboTotalPrice = combo.price.mul(item.quantity);
          subtotal = subtotal.add(comboTotalPrice);

          const comboItemCount = new Prisma.Decimal(combo.items.length || 1);
          const pricePerItem = comboTotalPrice.div(comboItemCount);

          for (const comboItem of combo.items) {
            const quantity = comboItem.quantity.mul(item.quantity);
            const itemCost = comboItem.product.cost.mul(quantity);
            totalOrderCost = totalOrderCost.add(itemCost);

            createdOrderItems.push(await tx.orderItem.create({
              data: { orderId: order.id, productId: comboItem.productId, productName: `${comboItem.product.name} (Combo: ${combo.name})`, quantity, unitPrice: combo.price.div(comboItemCount), subtotal: pricePerItem, costSnapshot: itemCost, sourceComboId: combo.id, notes: item.note },
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
      await tx.payment.create({
        data: {
          orderId: order.id,
          method: paymentMethod,
          amount: finalTotal,
          status: paymentMethod === 'pending' ? 'pending' : 'paid',
          createdById: userId,
        },
      });
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

      // Mandadito (delivery): the delivery amount is NEVER part of the order's revenue
      // (subtotal/total/Payment.amount above already exclude it). What happens next depends
      // on who is responsible for the money — see order.validator.ts / income statement docs.
      if (hasDelivery && deliveryAmount) {
        const deliveryAmountDecimal = new Prisma.Decimal(deliveryAmount);

        await tx.order.update({
          where: { id: order.id },
          data: {
            hasDelivery: true,
            deliveryAmount: deliveryAmountDecimal,
            deliveryResponsible,
            deliveryPaymentMethod: deliveryResponsible === 'customer_to_business' ? deliveryPaymentMethod : null,
          },
        });

        if (deliveryResponsible === 'customer_to_business' && deliveryPaymentMethod === 'cash') {
          // Third-party cash physically enters the drawer but is NOT revenue — it's pending
          // handoff to the courier (see OrderService.handoffDelivery).
          await tx.cashMovement.create({
            data: {
              cashSessionId: openCashSession.id,
              type: 'delivery_collected',
              amount: deliveryAmountDecimal,
              referenceType: 'order',
              referenceId: order.id,
              description: `Mandadito recibido — Venta #${order.orderNumber.toString()}`,
              createdById: userId,
            },
          });
          await tx.cashSession.update({
            where: { id: openCashSession.id },
            data: { expectedAmount: { increment: deliveryAmountDecimal } },
          });
        }

        if (deliveryResponsible === 'business_absorbs') {
          // This IS a real expense for Andy's — auto-create an Expense so it flows into
          // Gastos Variables through the existing mechanism, no income-statement changes needed.
          // The courier is always paid in cash from the drawer, regardless of how the food was paid.
          const deliveryExpense = await tx.expense.create({
            data: {
              category: 'mandadito',
              description: `Mandadito absorbido — Venta #${order.orderNumber.toString()}`,
              amount: deliveryAmountDecimal,
              paymentMethod: 'cash',
              cashSessionId: openCashSession.id,
              sourceOrderId: order.id,
              createdById: userId,
            },
          });
          await tx.cashMovement.create({
            data: {
              cashSessionId: openCashSession.id,
              type: 'expense',
              amount: deliveryAmountDecimal,
              referenceType: 'expense',
              referenceId: deliveryExpense.id,
              description: `Mandadito absorbido — Venta #${order.orderNumber.toString()}`,
              createdById: userId,
            },
          });
          await tx.cashSession.update({
            where: { id: openCashSession.id },
            data: { expectedAmount: { decrement: deliveryAmountDecimal } },
          });
        }

        // 'customer_to_courier': purely informational fields on the Order, no financial movement.
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
  },

  async getPendingPayments(user: AuthUser) {
    if (!user.permissions?.includes('sales.read')) {
      throw new AuthorizationError('No tienes permiso para consultar pagos pendientes.');
    }

    return prisma.payment.findMany({
      where: { status: 'pending' },
      include: {
        order: {
          select: { orderNumber: true, customerName: true, total: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async settlePayment(paymentId: string, settleMethod: 'cash' | 'transfer', user: AuthUser) {
    if (!user.permissions?.includes('sales.create')) {
      throw new AuthorizationError('No tienes permiso para liquidar pagos pendientes.');
    }

    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment) {
      throw new NotFoundError('Pago no encontrado.');
    }
    if (payment.status !== 'pending') {
      const error = new Error('Este pago ya fue liquidado o no está pendiente.');
      error.name = 'BusinessRuleError';
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'paid', method: settleMethod, paidAt: new Date() },
      });

      if (settleMethod === 'cash') {
        const openCashSession = await tx.cashSession.findFirst({
          where: { status: 'open' },
          orderBy: { openedAt: 'desc' },
        });
        if (!openCashSession) {
          const error = new Error('No hay una caja abierta para liquidar en efectivo.');
          error.name = 'BusinessRuleError';
          throw error;
        }

        await tx.cashMovement.create({
          data: {
            cashSessionId: openCashSession.id,
            type: 'sale',
            amount: payment.amount,
            referenceType: 'order',
            referenceId: payment.orderId,
            description: `Liquidación de pago pendiente — Venta #${payment.order.orderNumber.toString()}`,
            createdById: user.id,
          },
        });
        await tx.cashSession.update({
          where: { id: openCashSession.id },
          data: { expectedAmount: { increment: payment.amount } },
        });
      }

      return updatedPayment;
    });
  },

  async getPendingDeliveries(user: AuthUser) {
    if (!user.permissions?.includes('sales.read')) {
      throw new AuthorizationError('No tienes permiso para consultar mandaditos pendientes.');
    }

    return prisma.order.findMany({
      where: {
        hasDelivery: true,
        deliveryResponsible: 'customer_to_business',
        deliveryHandedOff: false,
        status: { not: 'cancelled' },
      },
      select: { id: true, orderNumber: true, customerName: true, deliveryAmount: true, deliveryPaymentMethod: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  },

  async handoffDelivery(orderId: string, user: AuthUser) {
    if (!user.permissions?.includes('sales.create')) {
      throw new AuthorizationError('No tienes permiso para liquidar mandaditos.');
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundError('Pedido no encontrado.');
    }
    if (!order.hasDelivery || order.deliveryResponsible !== 'customer_to_business') {
      const error = new Error('Este pedido no tiene un mandadito pendiente de entrega.');
      error.name = 'BusinessRuleError';
      throw error;
    }
    if (order.deliveryHandedOff) {
      const error = new Error('El mandadito de este pedido ya fue entregado.');
      error.name = 'BusinessRuleError';
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { deliveryHandedOff: true, deliveryHandedOffAt: new Date() },
      });

      if (order.deliveryPaymentMethod === 'cash') {
        const openCashSession = await tx.cashSession.findFirst({
          where: { status: 'open' },
          orderBy: { openedAt: 'desc' },
        });
        if (!openCashSession) {
          const error = new Error('No hay una caja abierta para entregar el mandadito.');
          error.name = 'BusinessRuleError';
          throw error;
        }

        await tx.cashMovement.create({
          data: {
            cashSessionId: openCashSession.id,
            type: 'delivery_handoff',
            amount: order.deliveryAmount,
            referenceType: 'order',
            referenceId: orderId,
            description: `Mandadito entregado al repartidor — Venta #${order.orderNumber.toString()}`,
            createdById: user.id,
          },
        });
        await tx.cashSession.update({
          where: { id: openCashSession.id },
          data: { expectedAmount: { decrement: order.deliveryAmount } },
        });
      }

      return updatedOrder;
    });
  },

  async updateOrder(id: string, data: z.infer<typeof updateOrderSchema>, user: AuthUser) {
    if (!user.permissions?.includes('sales.update')) {
      throw new AuthorizationError('No tienes permiso para editar pedidos.');
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundError('Pedido no encontrado.');
    }

    const previousValues = {
      customerName: order.customerName,
      notes: order.notes,
    };

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id },
        data: {
          ...(data.customerName !== undefined && { customerName: data.customerName }),
          ...(data.notes !== undefined && { notes: data.notes }),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'ORDER_EDITED',
          metadata: {
            orderId: id,
            previousValues,
            newValues: { customerName: data.customerName, notes: data.notes },
          },
        },
      });

      return result;
    });

    return updatedOrder;
  },

  async findByDate(dateStr: string, user: AuthUser) {
    if (!user.permissions?.includes('sales.read')) {
      throw new AuthorizationError('No tienes permiso para consultar pedidos.');
    }

    const { start, end } = getZonedDayBoundaries(dateStr);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: {
        items: { include: { extras: true } },
        payments: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const orderIds = orders.map((o) => o.id);
    const saleCashMovements = await prisma.cashMovement.findMany({
      where: { referenceType: 'order', referenceId: { in: orderIds }, type: 'sale' },
      select: { referenceId: true, receivedAmount: true, changeAmount: true },
    });
    const cashMovementByOrderId = new Map(saleCashMovements.map((m) => [m.referenceId, m]));

    return orders.map((order) => ({
      ...order,
      receivedAmount: cashMovementByOrderId.get(order.id)?.receivedAmount ?? null,
      changeAmount: cashMovementByOrderId.get(order.id)?.changeAmount ?? null,
    }));
  },
};

type CreateOrderInput = z.infer<typeof createOrderSchema>;
