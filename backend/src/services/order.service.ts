import { OrderStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  createOrderSchema,
  filterQuerySchema,
  updateOrderStatusSchema,
  updateOrderSchema,
} from '../validators/order.validator';
import { OrderRepository } from '../repositories/order.repository';
import { UserRepository } from '../repositories/user.repository';
import { CashRepository } from '../repositories/cash.repository';
import { InventoryRepository } from '../repositories/inventory.repository';
import { ExpenseRepository } from '../repositories/expense.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { incomeStatementRepository } from '../repositories/income-statement.repository';
import { runInTransaction, type Tx } from '../repositories/transaction';
import { NotificationService } from './notification.service';
import { AuthUser } from './auth.service';
import { auditLog, logger } from '../utils/logger';
import { calculateBestPromotion, promotionsForProduct, type PricingPromotion, type PromotionScope } from './pricing.service';
import { AuthorizationError, NotFoundError, ValidationError } from '../utils/errors';
import { paginationMeta, paginationOffset } from '../utils/pagination';
import { getZonedDayBoundaries, getTodayInZone, getZonedCalendarDate, getCalendarDateAsUtc } from '../utils/businessDate';

// --- Custom Errors for Service Layer ---

class StateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateTransitionError';
  }
}

function businessRuleError(message: string) {
  const error = new Error(message);
  error.name = 'BusinessRuleError';
  return error;
}

const ZERO = new Prisma.Decimal(0);

/**
 * Cash session that should receive a reversal for money originally recorded in
 * `originalSessionId`. A closed session is a finished cash cut and must not change, so
 * the reversal is posted to the currently open session instead (the refund leaves the
 * drawer today).
 */
async function resolveReversalSessionId(tx: Tx, originalSessionId: string): Promise<string> {
  const original = await CashRepository.findSessionStatus(tx, originalSessionId);
  if (original?.status === 'open') return originalSessionId;

  const openSession = await CashRepository.findOpenSession(tx);
  if (!openSession) {
    throw businessRuleError('La venta pertenece a una caja ya cerrada. Abre la caja para registrar la devolución.');
  }
  return openSession.id;
}

async function applyPromotions(
  orderItems: (Prisma.OrderItemGetPayload<{ include: { product: true } }>)[],
  promotions: (PricingPromotion & PromotionScope)[],
) {
  return orderItems.flatMap((item) => {
    if (item.sourceComboId) return [];
    // Only the promotions linked to this product (or its category) apply — N-01.
    const applicable = promotionsForProduct(promotions, item.product);
    const pricing = calculateBestPromotion(item.unitPrice, item.quantity.toNumber(), applicable);
    return pricing.discount.gt(0) ? [{ orderItemId: item.id, amount: pricing.discount }] : [];
  });
}

/** Adds `quantity` to the running total of `key` in `map`. */
function accumulate(map: Map<string, Prisma.Decimal>, key: string, quantity: Prisma.Decimal) {
  map.set(key, (map.get(key) ?? ZERO).add(quantity));
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

    const order = await OrderRepository.findPlain(id);
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

    let deletedExpenseDate: Date | null = null;
    const result = await runInTransaction(async (tx) => {
      // Re-check the status inside the transaction: the read above happened outside it, so
      // a concurrent request may already have moved (or cancelled) this order.
      const current = await OrderRepository.findStatus(tx, id);
      if (!current || current.status !== order.status) {
        throw new StateTransitionError('El pedido cambió de estado mientras se procesaba. Recarga e intenta de nuevo.');
      }

      if (status === OrderStatus.cancelled && order.inventoryProcessed) {
        // Give back the ingredients the sale consumed.
        const inventoryMovements = await InventoryRepository.findSaleMovementsForOrder(tx, order.id);
        for (const movement of inventoryMovements) {
          await InventoryRepository.updateStock(movement.ingredientId, movement.quantity.negated(), tx);
          await InventoryRepository.createMovement({
            ingredientId: movement.ingredientId,
            type: 'sale_reversal',
            quantity: movement.quantity.negated(),
            referenceType: 'order_cancellation',
            referenceId: order.id,
            createdById: user.id,
          }, tx);
        }

        // Refund the cash sale (money leaves the drawer).
        const saleMovements = await CashRepository.findMovements(tx, {
          ...(order.cashSessionId && { cashSessionId: order.cashSessionId }),
          referenceType: 'order',
          referenceId: order.id,
          type: 'sale',
        });
        for (const movement of saleMovements) {
          await CashRepository.recordMovement(tx, {
            cashSessionId: await resolveReversalSessionId(tx, movement.cashSessionId),
            type: 'sale_reversal',
            amount: movement.amount.negated(),
            drawerEffect: movement.amount.negated(),
            referenceType: 'order_cancellation',
            referenceId: order.id,
            description: `Cancelación de venta #${order.orderNumber.toString()}`,
            createdById: user.id,
          });
        }

        // Pending (pay-later) payments are cancelled too, so they leave the pending list
        // and can no longer be settled for a sale that no longer exists.
        await OrderRepository.cancelPayments(tx, order.id);

        // Mandadito reversal — a cancelled sale can't leave third-party delivery cash or an
        // auto-generated delivery expense still affecting the drawer / Gastos Variables.
        if (order.hasDelivery && order.deliveryResponsible === 'customer_to_business' && !order.deliveryHandedOff) {
          const collectedMovement = await CashRepository.findFirstMovement(tx, {
            referenceType: 'order',
            referenceId: order.id,
            type: 'delivery_collected',
          });
          if (collectedMovement) {
            await CashRepository.recordMovement(tx, {
              cashSessionId: await resolveReversalSessionId(tx, collectedMovement.cashSessionId),
              type: 'delivery_collected_reversal',
              amount: collectedMovement.amount.negated(),
              drawerEffect: collectedMovement.amount.negated(),
              referenceType: 'order_cancellation',
              referenceId: order.id,
              description: `Cancelación de mandadito — Venta #${order.orderNumber.toString()}`,
              createdById: user.id,
            });
          }
        }

        if (order.hasDelivery && order.deliveryResponsible === 'business_absorbs') {
          const deliveryExpense = await ExpenseRepository.findBySourceOrder(tx, order.id);
          if (deliveryExpense) {
            const expenseMovement = await CashRepository.findFirstMovement(tx, {
              referenceType: 'expense',
              referenceId: deliveryExpense.id,
              type: 'expense',
            });
            if (expenseMovement) {
              // The courier's cash comes back into the drawer.
              await CashRepository.recordMovement(tx, {
                cashSessionId: await resolveReversalSessionId(tx, expenseMovement.cashSessionId),
                type: 'expense_reversal',
                amount: expenseMovement.amount.negated(),
                drawerEffect: expenseMovement.amount,
                referenceType: 'order_cancellation',
                referenceId: order.id,
                description: `Cancelación de mandadito absorbido — Venta #${order.orderNumber.toString()}`,
                createdById: user.id,
              });
            }
            // The expense was auto-generated by this sale — remove it so it stops
            // counting in Gastos Variables now that the sale no longer exists.
            await ExpenseRepository.delete(tx, deliveryExpense.id);
            deletedExpenseDate = deliveryExpense.expenseDate;
          }
        }

        updateData.inventoryProcessed = false;
      }

      const updatedOrder = await OrderRepository.update(tx, id, updateData);
      await AuditLogRepository.create({
        userId: user.id,
        action: 'ORDER_STATUS_CHANGED',
        metadata: {
          orderId: id,
          previousStatus: order.status,
          newStatus: status,
          ...(reason && { reason }),
        },
      }, tx);
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
    }, { serializable: true });

    // Paid sales count as revenue whatever their kitchen status (utils/revenueRecognition.ts),
    // so only a cancellation changes the income statement of the day the order was created:
    // drop that day's frozen (final) snapshot so it is recomputed on the next read.
    if (status === OrderStatus.cancelled) {
      const affectedDates = new Set([getZonedCalendarDate(order.createdAt)]);
      // Assigned inside the transaction callback, which TS flow analysis doesn't track.
      const expenseDate = deletedExpenseDate as Date | null;
      if (expenseDate) affectedDates.add(getZonedCalendarDate(expenseDate));
      for (const dateStr of affectedDates) {
        await incomeStatementRepository.invalidateSnapshot(dateStr);
      }
    }

    return result;
  },

  async create(orderData: CreateOrderInput, userId: string, idempotencyKey: string, attempt = 0, requestId?: string): Promise<Prisma.OrderGetPayload<{ include: { items: { include: { extras: true } } } }>> {
    const { items, paymentMethod, cashSessionId, cashReceived, hasDelivery, deliveryAmount, deliveryResponsible, deliveryPaymentMethod, ...restOfOrder } = orderData;
    // L-07: business day as a calendar date, so promotions compare correctly on their last day
    // whatever the server's timezone.
    const { date: businessDate, weekday } = getCalendarDateAsUtc(getTodayInZone());

    const productIds = items.map(item => item.productId).filter(Boolean) as string[];
    const comboIds = items.map(item => item.comboId).filter(Boolean) as string[];
    const extraIds = items.flatMap(item => item.extras?.map(e => e.extraId) || []).filter(Boolean);

    try {
      const result = await runInTransaction(async (tx) => {
        const existingOrder = await OrderRepository.findByIdempotencyKey(userId, idempotencyKey, tx);
        if (existingOrder) return { order: existingOrder, wasCreated: false as const };

        // Product/combo/extra/promotion data is read inside the transaction (not before it)
        // so Serializable isolation covers price/isActive against concurrent changes: a price
        // update or deactivation committed after this point conflicts here instead of silently
        // producing an order built from stale data.
        const catalog = await OrderRepository.loadSaleCatalog(tx, { productIds, comboIds, extraIds, businessDate, weekday });

        const productsMap = new Map(catalog.products.map(p => [p.id, p]));
        const combosMap = new Map(catalog.combos.map(c => [c.id, c]));
        const extrasMap = new Map(catalog.extras.map(e => [e.id, e]));

        if (productIds.some((id) => !productsMap.has(id))) {
          throw new ValidationError('Uno o más productos no existen o están inactivos.');
        }
        if (comboIds.some((id) => !combosMap.has(id))) {
          throw new ValidationError('Uno o más combos no existen, están inactivos o no están disponibles hoy.');
        }
        if (extraIds.some((id) => !extrasMap.has(id))) {
          throw new ValidationError('Uno o más extras no existen o están inactivos.');
        }
        const validProductExtras = new Set(catalog.productExtras.map(({ productId, extraId }) => `${productId}:${extraId}`));
        for (const item of items) {
          if (!item.productId) continue;
          for (const extra of item.extras ?? []) {
            if (!validProductExtras.has(`${item.productId}:${extra.extraId}`)) {
              throw new ValidationError(`El extra ${extra.extraId} no pertenece al producto ${item.productId}.`);
            }
          }
        }

        const openCashSession = await CashRepository.findOpenSession(tx, cashSessionId);
        if (!openCashSession) {
          throw businessRuleError('No hay una caja abierta para registrar la venta.');
        }

        let totalOrderCost = ZERO;
        let subtotal = ZERO;

        // Handle customer name generation
        let finalCustomerName = restOfOrder.customerName;
        if (!finalCustomerName || finalCustomerName.trim().toLowerCase() === 'cliente') {
          finalCustomerName = await OrderRepository.nextCustomerName(tx);
        }

        const order = await OrderRepository.create(tx, {
          customerName: finalCustomerName,
          notes: restOfOrder.notes,
          status: 'pending',
          createdById: userId,
          cashSessionId: openCashSession.id,
          idempotencyKey,
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
            const orderItem = await OrderRepository.createItem(tx, {
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
                  return {
                    extraId: extra.id,
                    extraName: extra.name,
                    quantity: extraData.quantity,
                    unitPrice: extra.price,
                    subtotal: extra.price.mul(extraData.quantity),
                    // L-06: total cost of the extra line (like OrderItem.costSnapshot), not unit cost.
                    costSnapshot: extra.cost.mul(extraData.quantity),
                  };
                }),
              },
            });
            createdOrderItems.push(orderItem);
            for (const extraData of item.extras ?? []) {
              const extra = extrasMap.get(extraData.extraId);
              if (!extra) throw new ValidationError(`Extra con ID ${extraData.extraId} no encontrado o inactivo.`);
              subtotal = subtotal.add(extra.price.mul(extraData.quantity));
              totalOrderCost = totalOrderCost.add(extra.cost.mul(extraData.quantity));
            }
          } else if (item.comboId) {
            const combo = combosMap.get(item.comboId);
            if (!combo) throw new ValidationError(`Combo con ID ${item.comboId} no encontrado o no está activo para hoy.`);
            const comboTotalPrice = combo.price.mul(item.quantity);
            subtotal = subtotal.add(comboTotalPrice);

            // L-05: split the combo price evenly across its products in whole cents; the last
            // product absorbs the rounding remainder, so the lines always add up to the combo price.
            const comboItemCount = combo.items.length || 1;
            const evenShare = comboTotalPrice.div(comboItemCount).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);

            for (const [index, comboItem] of combo.items.entries()) {
              const quantity = comboItem.quantity.mul(item.quantity);
              const itemCost = comboItem.product.cost.mul(quantity);
              totalOrderCost = totalOrderCost.add(itemCost);
              const isLast = index === combo.items.length - 1;
              const lineSubtotal = isLast ? comboTotalPrice.sub(evenShare.mul(comboItemCount - 1)) : evenShare;

              createdOrderItems.push(await OrderRepository.createItem(tx, {
                orderId: order.id,
                productId: comboItem.productId,
                productName: `${comboItem.product.name} (Combo: ${combo.name})`,
                quantity,
                unitPrice: lineSubtotal.div(quantity).toDecimalPlaces(2),
                subtotal: lineSubtotal,
                costSnapshot: itemCost,
                sourceComboId: combo.id,
                notes: item.note,
              }));
            }
          }
        }

        const itemDiscounts = await applyPromotions(createdOrderItems, catalog.promotions);
        let totalDiscount = ZERO;
        for (const discount of itemDiscounts) {
          totalDiscount = totalDiscount.add(discount.amount);
          await OrderRepository.applyItemDiscount(tx, discount.orderItemId, discount.amount);
        }
        const finalTotal = Prisma.Decimal.max(ZERO, subtotal.sub(totalDiscount));
        const isCashPayment = paymentMethod === 'cash';
        const receivedAmount = isCashPayment ? new Prisma.Decimal(cashReceived ?? 0) : null;
        if (isCashPayment && (!receivedAmount || receivedAmount.lt(finalTotal))) {
          throw businessRuleError('El monto recibido debe cubrir el total de la venta.');
        }
        const changeAmount = receivedAmount ? receivedAmount.sub(finalTotal) : null;

        // Ingredients consumed by the products (recipes) and the extras (extra recipes).
        const productQuantities = new Map<string, Prisma.Decimal>();
        for (const item of createdOrderItems) {
          accumulate(productQuantities, item.productId, item.quantity);
        }
        const { recipes, extraRecipes } = await OrderRepository.findRecipes(tx, Array.from(productQuantities.keys()), extraIds);
        const ingredientRequirements = new Map<string, Prisma.Decimal>();
        for (const recipe of recipes) {
          accumulate(ingredientRequirements, recipe.ingredientId, recipe.quantity.mul(productQuantities.get(recipe.productId) ?? ZERO));
        }
        for (const item of items) {
          for (const extra of item.extras ?? []) {
            for (const recipe of extraRecipes.filter((entry) => entry.extraId === extra.extraId)) {
              accumulate(ingredientRequirements, recipe.ingredientId, recipe.quantity.mul(extra.quantity));
            }
          }
        }
        const inventoryMovements: Prisma.InventoryMovementCreateManyInput[] = [];
        for (const [ingredientId, quantity] of ingredientRequirements) {
          if (!(await InventoryRepository.decrementStockIfAvailable(tx, ingredientId, quantity))) {
            throw businessRuleError('Stock insuficiente para completar la venta.');
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
        await InventoryRepository.createMovements(inventoryMovements, tx);

        const updatedOrder = await OrderRepository.updateWithItems(tx, order.id, {
          subtotal,
          discount: totalDiscount,
          total: finalTotal,
          totalCost: totalOrderCost,
          inventoryProcessed: true,
        });
        await OrderRepository.createPayment(tx, {
          orderId: order.id,
          method: paymentMethod,
          amount: finalTotal,
          status: paymentMethod === 'pending' ? 'pending' : 'paid',
          createdById: userId,
        });
        if (isCashPayment) {
          await CashRepository.recordMovement(tx, {
            cashSessionId: openCashSession.id,
            type: 'sale',
            amount: finalTotal,
            drawerEffect: finalTotal,
            receivedAmount,
            changeAmount,
            referenceType: 'order',
            referenceId: order.id,
            description: `Venta #${order.orderNumber.toString()}`,
            createdById: userId,
          });
        }

        // Mandadito (delivery): the delivery amount is NEVER part of the order's revenue
        // (subtotal/total/Payment.amount above already exclude it). What happens next depends
        // on who is responsible for the money — see order.validator.ts / income statement docs.
        if (hasDelivery && deliveryAmount) {
          const deliveryAmountDecimal = new Prisma.Decimal(deliveryAmount);

          await OrderRepository.update(tx, order.id, {
            hasDelivery: true,
            deliveryAmount: deliveryAmountDecimal,
            deliveryResponsible,
            deliveryPaymentMethod: deliveryResponsible === 'customer_to_business' ? deliveryPaymentMethod : null,
          });

          if (deliveryResponsible === 'customer_to_business' && deliveryPaymentMethod === 'cash') {
            // Third-party cash physically enters the drawer but is NOT revenue — it's pending
            // handoff to the courier (see OrderService.handoffDelivery).
            await CashRepository.recordMovement(tx, {
              cashSessionId: openCashSession.id,
              type: 'delivery_collected',
              amount: deliveryAmountDecimal,
              drawerEffect: deliveryAmountDecimal,
              referenceType: 'order',
              referenceId: order.id,
              description: `Mandadito recibido — Venta #${order.orderNumber.toString()}`,
              createdById: userId,
            });
          }

          if (deliveryResponsible === 'business_absorbs') {
            // This IS a real expense for Andy's — auto-create an Expense so it flows into
            // Gastos Variables through the existing mechanism, no income-statement changes needed.
            // The courier is always paid in cash from the drawer, regardless of how the food was paid.
            const description = `Mandadito absorbido — Venta #${order.orderNumber.toString()}`;
            const deliveryExpense = await ExpenseRepository.create(tx, {
              category: 'mandadito',
              description,
              amount: deliveryAmountDecimal,
              paymentMethod: 'cash',
              cashSessionId: openCashSession.id,
              sourceOrderId: order.id,
              createdById: userId,
            });
            await CashRepository.recordMovement(tx, {
              cashSessionId: openCashSession.id,
              type: 'expense',
              amount: deliveryAmountDecimal,
              drawerEffect: deliveryAmountDecimal.negated(),
              referenceType: 'expense',
              referenceId: deliveryExpense.id,
              description,
              createdById: userId,
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
      }, { serializable: true });

      // Notifications are dispatched after the transaction commits (not inside it) so
      // that writing to an unrelated NotificationRecipient row can't contribute to a
      // serialization conflict on the sales transaction, and only for a freshly created
      // order (not an idempotent replay of an already-committed one).
      if (result.wasCreated) {
        // The sale is already committed: a notification failure must not turn it into a 500.
        try {
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
        } catch (notificationError) {
          logger.error({ err: notificationError, orderId: result.order.id, requestId }, 'Order notification failed');
        }
      }

      return result.order;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) {
        return OrderService.create(orderData, userId, idempotencyKey, attempt + 1, requestId);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        for (let lookupAttempt = 0; lookupAttempt < 3; lookupAttempt += 1) {
          const existingOrder = await OrderRepository.findByIdempotencyKey(userId, idempotencyKey);
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

    return OrderRepository.findPendingPayments();
  },

  async settlePayment(paymentId: string, settleMethod: 'cash' | 'transfer', user: AuthUser) {
    if (!user.permissions?.includes('sales.create')) {
      throw new AuthorizationError('No tienes permiso para liquidar pagos pendientes.');
    }

    const payment = await OrderRepository.findPaymentWithOrder(paymentId);
    if (!payment) {
      throw new NotFoundError('Pago no encontrado.');
    }
    if (payment.status !== 'pending') {
      throw businessRuleError('Este pago ya fue liquidado o no está pendiente.');
    }
    if (payment.order.status === OrderStatus.cancelled) {
      throw businessRuleError('No se puede liquidar el pago de un pedido cancelado.');
    }

    const updatedPayment = await runInTransaction(async (tx) => {
      // Conditional update: only one of two concurrent settle requests can flip the
      // payment from 'pending', so the cash movement below is never recorded twice.
      if (!(await OrderRepository.claimPendingPayment(tx, paymentId, settleMethod))) {
        throw businessRuleError('Este pago ya fue liquidado o no está pendiente.');
      }

      if (settleMethod === 'cash') {
        const openCashSession = await CashRepository.findOpenSession(tx);
        if (!openCashSession) {
          throw businessRuleError('No hay una caja abierta para liquidar en efectivo.');
        }

        await CashRepository.recordMovement(tx, {
          cashSessionId: openCashSession.id,
          type: 'sale',
          amount: payment.amount,
          drawerEffect: payment.amount,
          referenceType: 'order',
          referenceId: payment.orderId,
          description: `Liquidación de pago pendiente — Venta #${payment.order.orderNumber.toString()}`,
          createdById: user.id,
        });
      }

      return OrderRepository.findPayment(tx, paymentId);
    }, { serializable: true });

    // A settled payment now counts as revenue for the day the order was created.
    await incomeStatementRepository.invalidateSnapshot(getZonedCalendarDate(payment.order.createdAt));

    return updatedPayment;
  },

  async getPendingDeliveries(user: AuthUser) {
    if (!user.permissions?.includes('sales.read')) {
      throw new AuthorizationError('No tienes permiso para consultar mandaditos pendientes.');
    }

    return OrderRepository.findPendingDeliveries();
  },

  async handoffDelivery(orderId: string, user: AuthUser) {
    if (!user.permissions?.includes('sales.create')) {
      throw new AuthorizationError('No tienes permiso para liquidar mandaditos.');
    }

    const order = await OrderRepository.findPlain(orderId);
    if (!order) {
      throw new NotFoundError('Pedido no encontrado.');
    }
    if (!order.hasDelivery || order.deliveryResponsible !== 'customer_to_business') {
      throw businessRuleError('Este pedido no tiene un mandadito pendiente de entrega.');
    }
    if (order.status === OrderStatus.cancelled) {
      throw businessRuleError('El pedido está cancelado; su mandadito ya no se entrega.');
    }
    if (order.deliveryHandedOff) {
      throw businessRuleError('El mandadito de este pedido ya fue entregado.');
    }

    return runInTransaction(async (tx) => {
      // Conditional update so two concurrent handoffs can't both take cash from the drawer.
      if (!(await OrderRepository.claimDeliveryHandoff(tx, orderId))) {
        throw businessRuleError('El mandadito de este pedido ya fue entregado.');
      }

      if (order.deliveryPaymentMethod === 'cash') {
        const openCashSession = await CashRepository.findOpenSession(tx);
        if (!openCashSession) {
          throw businessRuleError('No hay una caja abierta para entregar el mandadito.');
        }

        // The courier takes the collected cash out of the drawer.
        await CashRepository.recordMovement(tx, {
          cashSessionId: openCashSession.id,
          type: 'delivery_handoff',
          amount: order.deliveryAmount,
          drawerEffect: order.deliveryAmount.negated(),
          referenceType: 'order',
          referenceId: orderId,
          description: `Mandadito entregado al repartidor — Venta #${order.orderNumber.toString()}`,
          createdById: user.id,
        });
      }

      return OrderRepository.findPlain(orderId, tx);
    }, { serializable: true });
  },

  async updateOrder(id: string, data: z.infer<typeof updateOrderSchema>, user: AuthUser) {
    if (!user.permissions?.includes('sales.update')) {
      throw new AuthorizationError('No tienes permiso para editar pedidos.');
    }

    const order = await OrderRepository.findPlain(id);
    if (!order) {
      throw new NotFoundError('Pedido no encontrado.');
    }

    const previousValues = {
      customerName: order.customerName,
      notes: order.notes,
    };

    return runInTransaction(async (tx) => {
      const result = await OrderRepository.update(tx, id, {
        ...(data.customerName !== undefined && { customerName: data.customerName }),
        ...(data.notes !== undefined && { notes: data.notes }),
      });

      await AuditLogRepository.create({
        userId: user.id,
        action: 'ORDER_EDITED',
        metadata: {
          orderId: id,
          previousValues,
          newValues: { customerName: data.customerName, notes: data.notes },
        },
      }, tx);

      return result;
    });
  },

  async findByDate(dateStr: string, user: AuthUser) {
    if (!user.permissions?.includes('sales.read')) {
      throw new AuthorizationError('No tienes permiso para consultar pedidos.');
    }

    const { start, end } = getZonedDayBoundaries(dateStr);

    const orders = await OrderRepository.findCreatedBetween(start, end);
    const saleCashMovements = await CashRepository.findSaleTenderByOrderIds(orders.map((o) => o.id));
    const cashMovementByOrderId = new Map(saleCashMovements.map((m) => [m.referenceId, m]));

    return orders.map((order) => ({
      ...order,
      receivedAmount: cashMovementByOrderId.get(order.id)?.receivedAmount ?? null,
      changeAmount: cashMovementByOrderId.get(order.id)?.changeAmount ?? null,
    }));
  },
};

type CreateOrderInput = z.infer<typeof createOrderSchema>;
