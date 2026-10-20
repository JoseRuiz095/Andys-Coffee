import { OrderStatus, Prisma, type Order } from '@prisma/client';
import { z } from 'zod';
import {
  createOrderSchema,
  filterQuerySchema,
  quoteOrderSchema,
  requestCancellationSchema,
  reviewCancellationSchema,
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
import { priceSale } from './sale-pricing.service';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '../utils/errors';
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

/** Permission to approve cancelling a completed sale (ADMIN). */
export const APPROVE_CANCELLATION_PERMISSION = 'sales.approve_cancellation';

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

/**
 * Everything a cancelled sale must undo, inside the caller's transaction: legacy inventory
 * consumption, the cash it brought in (to the open drawer if its session is already closed),
 * its payments and its mandadito. Shared by a direct cancellation and an approved cancellation
 * request, so both reverse exactly the same things.
 */
async function reverseSaleForCancellation(tx: Tx, order: Order, user: AuthUser) {
  let deletedExpenseDate: Date | null = null;
  // Inventory reversal only for sales that consumed ingredients (sales made before ingredient
  // consumption left the MVP, 2026-10-20). Cash, payments and mandaditos are reversed for
  // every cancelled sale, independently of that flag.
  let inventoryReversed = false;
  if (order.inventoryProcessed) {
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
    inventoryReversed = true;
  }

  // Refund the cash sale (money leaves the drawer). Not filtered by the order's session:
  // a pay-later order settled in cash records its `sale` in the session open at settlement
  // time, which can be a later one.
  const saleMovements = await CashRepository.findMovements(tx, {
    referenceType: 'order',
    referenceId: order.id,
    type: 'sale',
  });
  for (const movement of saleMovements) {
    await CashRepository.recordMovement(tx, {
      cashSessionId: await resolveReversalSessionId(tx, movement.cashSessionId),
      type: 'sale_reversal',
      amount: movement.amount.negated(),
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

  return { inventoryReversed, deletedExpenseDate };
}

/**
 * Paid sales count as revenue whatever their kitchen status (utils/revenueRecognition.ts), so
 * a cancellation changes the income statement of the day the order was created (and of its
 * mandadito expense): drop those days' frozen snapshots so they are recomputed on next read.
 */
async function invalidateCancelledSaleSnapshots(order: Order, deletedExpenseDate: Date | null) {
  const affectedDates = new Set([getZonedCalendarDate(order.createdAt)]);
  if (deletedExpenseDate) affectedDates.add(getZonedCalendarDate(deletedExpenseDate));
  for (const dateStr of affectedDates) {
    await incomeStatementRepository.invalidateSnapshot(dateStr);
  }
}

/**
 * Marks the request approved (only if still pending) and cancels its completed sale with the
 * same reversals as a direct cancellation. Returns the date of a deleted mandadito expense.
 */
async function approveCancellationInTransaction(tx: Tx, requestId: string, order: Order, user: AuthUser, comment: string | null) {
  if (!(await OrderRepository.claimCancellationRequest(tx, requestId, { status: 'approved', reviewedById: user.id, reviewComment: comment }))) {
    throw businessRuleError('Esta solicitud ya fue revisada.');
  }
  const current = await OrderRepository.findStatus(tx, order.id);
  if (current?.status !== OrderStatus.completed) {
    throw new StateTransitionError('La venta ya no está completada; recarga e intenta de nuevo.');
  }

  const reversal = await reverseSaleForCancellation(tx, order, user);
  await OrderRepository.update(tx, order.id, {
    status: OrderStatus.cancelled,
    ...(reversal.inventoryReversed && { inventoryProcessed: false }),
  });
  await AuditLogRepository.create({
    userId: user.id,
    action: 'ORDER_STATUS_CHANGED',
    metadata: {
      orderId: order.id,
      previousStatus: OrderStatus.completed,
      newStatus: OrderStatus.cancelled,
      cancellationRequestId: requestId,
      ...(comment && { comment }),
    },
  }, tx);
  return reversal.deletedExpenseDate;
}

/** Notifications are best effort: the operation already committed, so a failure is only logged. */
async function notifySafely(recipients: () => Promise<{ id: string }[]>, data: { title: string; message: string; referenceId: string }) {
  try {
    const users = await recipients();
    await NotificationService.createNotification({ ...data, type: 'GENERAL' }, users.map(({ id }) => id));
  } catch (error) {
    logger.error({ err: error, referenceId: data.referenceId }, 'Cancellation request notification failed');
  }
}

export function shouldActivateScheduledOrder(referenceTime: Date, scheduledFor: Date | null | undefined) {
  return !!scheduledFor && scheduledFor.getTime() <= referenceTime.getTime();
}

export function canStartPreparingScheduledOrder(referenceTime: Date, scheduledFor: Date | null | undefined) {
  if (!scheduledFor) return true;
  const diffMs = scheduledFor.getTime() - referenceTime.getTime();
  return diffMs <= 20 * 60 * 1000 && diffMs >= 0;
}

export function shouldNotifyScheduledOrder(
  referenceTime: Date,
  scheduledFor: Date | null | undefined,
  lastNotifiedAt: Date | null | undefined,
) {
  if (!scheduledFor || lastNotifiedAt) return false;
  const diffMs = scheduledFor.getTime() - referenceTime.getTime();
  return diffMs > 0 && diffMs <= 20 * 60 * 1000;
}

// --- Main Service Logic ---

export const OrderService = {
  async activateDueScheduledOrders(tx: Tx | null = null) {
    const now = new Date();
    const dueOrders = await OrderRepository.findDueScheduledOrders(now, tx ?? undefined);

    for (const order of dueOrders) {
      const result = await OrderRepository.activateScheduledOrderIfPending(order.id, now, tx ?? undefined);

      if (result.count > 0) {
        auditLog({
          action: 'ORDER_SCHEDULED_ACTIVATED',
          entity: 'order',
          entityId: order.id,
          metadata: {
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            scheduledFor: order.scheduledFor,
            activatedAt: now.toISOString(),
          },
        }, 'Scheduled order activated');
      }
    }

    return dueOrders.length;
  },

  async notifyDueScheduledOrders(tx: Tx | null = null) {
    const now = new Date();
    const dueReminderOrders = await OrderRepository.findDueScheduledReminders(now, tx ?? undefined);

    let notifiedCount = 0;

    for (const order of dueReminderOrders) {
      const scheduledFor = order.scheduledFor ? new Date(order.scheduledFor) : null;
      if (!shouldNotifyScheduledOrder(now, scheduledFor, null)) {
        continue;
      }

      const updated = await OrderRepository.markScheduledReminderSent(order.id, now, tx ?? undefined);

      if (updated.count === 0) {
        continue;
      }

      try {
        const usersToNotify = await UserRepository.findActiveByRoleNames(['ADMIN', 'CAJERO']);
        if (usersToNotify.length > 0) {
          await NotificationService.createNotification(
            {
              title: 'Pedido programado',
              message: `La orden #${order.orderNumber.toString()} está próxima a su horario programado (${scheduledFor ? new Date(scheduledFor).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : 'próximo horario'}).`,
              type: 'NEW_ORDER',
              referenceId: order.id,
            },
            usersToNotify.map((user) => user.id),
          );
        }
        notifiedCount += 1;
      } catch (notificationError) {
        logger.error({ err: notificationError, orderId: order.id }, 'Scheduled order reminder notification failed');
      }
    }

    return notifiedCount;
  },

  async findAll(query: z.infer<typeof filterQuerySchema>, user: AuthUser) {
    const { page, limit } = query;
    const skip = paginationOffset(page, limit);

    // Scheduled orders are activated by the cron job every minute (jobs/orderScheduled.job.ts),
    // not on every read.
    const where: Prisma.OrderWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { customerName: { contains: query.search, mode: 'insensitive' } },
          { id: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    // The board shows what still needs work (any day: e.g. an order scheduled days ago) and
    // today's orders, so completed ones can still be found (and their cancellation requested).
    if (query.board) {
      where.AND = [{
        OR: [
          { status: { in: [OrderStatus.pending, OrderStatus.preparing, OrderStatus.ready] } },
          { createdAt: { gte: getZonedDayBoundaries(getTodayInZone()).start } },
        ],
      }];
    }

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

    if (status === OrderStatus.preparing && order.scheduledFor) {
      const windowMs = 20 * 60 * 1000;
      const diffMs = new Date(order.scheduledFor).getTime() - Date.now();
      if (diffMs > windowMs || diffMs < 0) {
        throw businessRuleError('Solo se puede empezar a preparar una orden programada cuando falta 20 minutos o menos para su horario.');
      }
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

      if (status === OrderStatus.cancelled) {
        const reversal = await reverseSaleForCancellation(tx, order, user);
        if (reversal.inventoryReversed) updateData.inventoryProcessed = false;
        deletedExpenseDate = reversal.deletedExpenseDate;
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
      return updatedOrder;
    }, { serializable: true });

    // Logged after the commit, so a transaction that rolls back leaves no "changed" line.
    auditLog({
      requestId,
      actor: { id: user.id, name: user.name },
      action: 'ORDER_STATUS_CHANGED',
      entity: 'order',
      entityId: id,
      previousState: order.status,
      newState: status,
    }, 'Order status changed');

    if (status === OrderStatus.cancelled) {
      // Assigned inside the transaction callback, which TS flow analysis doesn't track.
      await invalidateCancelledSaleSnapshots(order, deletedExpenseDate as Date | null);
    }

    return result;
  },

  async create(orderData: CreateOrderInput, userId: string, idempotencyKey: string, attempt = 0, requestId?: string): Promise<Prisma.OrderGetPayload<{ include: { items: { include: { extras: true } } } }>> {
    const { items, paymentMethod, cashSessionId, cashReceived, hasDelivery, deliveryAmount, deliveryResponsible, deliveryPaymentMethod, scheduledFor, ...restOfOrder } = orderData;
    const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
    if (scheduledDate && Number.isNaN(scheduledDate.getTime())) {
      throw new ValidationError('La fecha programada es inválida.');
    }
    if (scheduledDate && scheduledDate.getTime() <= Date.now()) {
      throw new ValidationError('La fecha programada debe ser futura.');
    }
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
        const catalog = await OrderRepository.loadSaleCatalog({ productIds, comboIds, extraIds, businessDate, weekday }, tx);
        // Validates the cart against the catalog and prices it with the same function the POS
        // quote uses (sale-pricing.service.ts), so what the cashier saw is what gets charged.
        const pricing = priceSale(items, catalog);

        const openCashSession = await CashRepository.findOpenSession(tx, cashSessionId);
        if (!openCashSession) {
          throw businessRuleError('No hay una caja abierta para registrar la venta.');
        }

        // Handle customer name generation
        let finalCustomerName = restOfOrder.customerName;
        if (!finalCustomerName || finalCustomerName.trim().toLowerCase() === 'cliente') {
          finalCustomerName = await OrderRepository.nextCustomerName(tx);
        }

        const order = await OrderRepository.create(tx, {
          customerName: finalCustomerName,
          notes: restOfOrder.notes,
          status: 'pending',
          scheduledFor: scheduledDate ?? null,
          activatedAt: null,
          createdById: userId,
          cashSessionId: openCashSession.id,
          idempotencyKey,
        });

        for (const pricedItem of pricing.items) {
          for (const line of pricedItem.lines) {
            await OrderRepository.createItem(tx, {
              orderId: order.id,
              productId: line.productId,
              productName: line.productName,
              temperature: line.temperature,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discount: line.discount,
              subtotal: line.subtotal,
              costSnapshot: line.costSnapshot,
              notes: line.notes,
              sourceComboId: line.sourceComboId,
              extras: {
                create: line.extras.map((extra) => ({
                  extraId: extra.extraId,
                  extraName: extra.extraName,
                  quantity: extra.quantity,
                  unitPrice: extra.unitPrice,
                  subtotal: extra.subtotal,
                  costSnapshot: extra.costSnapshot,
                })),
              },
            });
          }
        }

        const finalTotal = pricing.total;
        const isCashPayment = paymentMethod === 'cash';
        // Cash the customer hands over right now: the sale (if paid in cash) plus a mandadito
        // they pay to Andy's in cash. The mandadito is never revenue, but it is in the drawer.
        const deliveryCash = hasDelivery && deliveryAmount && deliveryResponsible === 'customer_to_business' && deliveryPaymentMethod === 'cash'
          ? new Prisma.Decimal(deliveryAmount)
          : ZERO;
        const cashDue = (isCashPayment ? finalTotal : ZERO).add(deliveryCash);
        const takesCash = isCashPayment || deliveryCash.gt(ZERO);
        const receivedAmount = takesCash && cashReceived !== undefined ? new Prisma.Decimal(cashReceived) : null;
        // A cash sale must say how much was received; a mandadito-only cash handover may omit it.
        const coversCashDue = receivedAmount ? receivedAmount.gte(cashDue) : !isCashPayment || cashDue.isZero();
        if (!coversCashDue) {
          throw businessRuleError(deliveryCash.gt(ZERO)
            ? 'El monto recibido debe cubrir el total a cobrar en efectivo (venta + mandadito).'
            : 'El monto recibido debe cubrir el total de la venta.');
        }
        const changeAmount = receivedAmount ? receivedAmount.sub(cashDue) : null;

        // Sales don't consume ingredients: recipe-based inventory is outside the MVP (business
        // decision 2026-10-20), so a sale never fails for lack of stock and leaves no inventory
        // movements. `inventoryProcessed` stays false.

        const updatedOrder = await OrderRepository.updateWithItems(tx, order.id, {
          subtotal: pricing.subtotal,
          discount: pricing.discount,
          total: finalTotal,
          totalCost: pricing.totalCost,
        });
        await OrderRepository.createPayment(tx, {
          orderId: order.id,
          method: paymentMethod,
          amount: finalTotal,
          status: paymentMethod === 'pending' ? 'pending' : 'paid',
          createdById: userId,
        });
        if (isCashPayment) {
          // receivedAmount/changeAmount describe the whole cash handover (sale + mandadito in
          // cash), so they are informational: `amount` is the sale's effect on the drawer.
          await CashRepository.recordMovement(tx, {
            cashSessionId: openCashSession.id,
            type: 'sale',
            amount: finalTotal,
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
              // When the sale itself isn't paid in cash, the tender belongs to the mandadito.
              ...(!isCashPayment && { receivedAmount, changeAmount }),
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
              amount: deliveryAmountDecimal.negated(),
              referenceType: 'expense',
              referenceId: deliveryExpense.id,
              description,
              createdById: userId,
            });
          }

          // 'customer_to_courier': purely informational fields on the Order, no financial movement.
        }

        return { order: updatedOrder, wasCreated: true as const };
      }, { serializable: true });

      // Logged after the commit: a serialization retry (P2034) must not log a sale twice.
      if (result.wasCreated) {
        auditLog({
          requestId,
          actor: { id: userId },
          action: 'ORDER_CREATED',
          entity: 'order',
          entityId: result.order.id,
          amount: result.order.total.toFixed(2),
        }, 'Order created');
      }

      // Notifications are dispatched after the transaction commits (not inside it) so
      // that writing to an unrelated NotificationRecipient row can't contribute to a
      // serialization conflict on the sales transaction, and only for a freshly created
      // order (not an idempotent replay of an already-committed one).
      if (result.wasCreated) {
        // The sale is already committed: a notification failure must not turn it into a 500.
        try {
          const usersToNotify = (await UserRepository.findActiveByRoleNames(['ADMIN', 'CAJERO']))
            .filter((user) => user.id !== userId);

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

  /**
   * Prices a cart without creating anything, with the same function and catalog rules as
   * `create`, so the POS shows the total that will be charged (promotions included). Money is
   * returned as fixed two-decimal strings, like every Decimal in the API.
   */
  async quote({ items }: z.infer<typeof quoteOrderSchema>) {
    const { date: businessDate, weekday } = getCalendarDateAsUtc(getTodayInZone());
    const catalog = await OrderRepository.loadSaleCatalog({
      productIds: items.map((item) => item.productId).filter(Boolean) as string[],
      comboIds: items.map((item) => item.comboId).filter(Boolean) as string[],
      extraIds: items.flatMap((item) => item.extras?.map((extra) => extra.extraId) ?? []),
      businessDate,
      weekday,
    });
    const pricing = priceSale(items, catalog);
    const money = (value: Prisma.Decimal) => value.toFixed(2);

    return {
      items: pricing.items.map((item) => ({ gross: money(item.gross), discount: money(item.discount), net: money(item.net) })),
      subtotal: money(pricing.subtotal),
      discount: money(pricing.discount),
      total: money(pricing.total),
    };
  },

  /**
   * Asks to cancel a completed sale. Completed sales can't be cancelled directly: an admin
   * approves the request (business decision 2026-10-20). When the requester can approve, the
   * request is approved at once (same transaction), so an admin doesn't wait on themselves.
   */
  async requestCancellation(orderId: string, { reason }: z.infer<typeof requestCancellationSchema>, user: AuthUser, requestId?: string) {
    if (!user.permissions?.includes('sales.create')) {
      throw new AuthorizationError('No tienes permiso para solicitar cancelaciones.');
    }
    const order = await OrderRepository.findPlain(orderId);
    if (!order) throw new NotFoundError('Pedido no encontrado.');
    if (order.status !== OrderStatus.completed) {
      throw businessRuleError(order.status === OrderStatus.cancelled
        ? 'Esta venta ya está cancelada.'
        : 'Solo las ventas completadas requieren aprobación; esta orden se puede cancelar directamente.');
    }
    const approvesItself = user.permissions.includes(APPROVE_CANCELLATION_PERMISSION);

    let deletedExpenseDate: Date | null = null;
    let request;
    try {
      request = await runInTransaction(async (tx) => {
        const current = await OrderRepository.findStatus(tx, orderId);
        if (current?.status !== OrderStatus.completed) {
          throw new StateTransitionError('El pedido cambió de estado mientras se procesaba. Recarga e intenta de nuevo.');
        }
        const created = await OrderRepository.createCancellationRequest(tx, { orderId, requestedById: user.id, reason });
        await AuditLogRepository.create({
          userId: user.id,
          action: 'ORDER_CANCELLATION_REQUESTED',
          metadata: { orderId, requestId: created.id, reason },
        }, tx);
        if (approvesItself) {
          deletedExpenseDate = await approveCancellationInTransaction(tx, created.id, order, user, null);
        }
        return created;
      }, { serializable: true });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Ya hay una solicitud de cancelación pendiente para esta venta.');
      }
      throw error;
    }

    auditLog({ requestId, actor: { id: user.id, name: user.name }, action: 'ORDER_CANCELLATION_REQUESTED', entity: 'order', entityId: orderId }, 'Order cancellation requested');
    if (approvesItself) {
      // Assigned inside the transaction callback, which TS flow analysis doesn't track.
      await invalidateCancelledSaleSnapshots(order, deletedExpenseDate as Date | null);
    } else {
      await notifySafely(
        () => UserRepository.findActiveWithPermission(APPROVE_CANCELLATION_PERMISSION),
        {
          title: 'Cancelación por aprobar',
          message: `${user.name} pide cancelar la venta #${order.orderNumber.toString()} (completada). Motivo: ${reason}`,
          referenceId: orderId,
        },
      );
    }
    return OrderRepository.findCancellationRequestSummary(request.id);
  },

  async getPendingCancellationRequests(user: AuthUser) {
    if (!user.permissions?.includes(APPROVE_CANCELLATION_PERMISSION)) {
      throw new AuthorizationError('No tienes permiso para revisar cancelaciones.');
    }
    return OrderRepository.findPendingCancellationRequests();
  },

  /** Approves (cancelling the sale with all its reversals) or rejects a pending request. */
  async reviewCancellation(
    requestId: string,
    decision: 'approve' | 'reject',
    { comment }: z.infer<typeof reviewCancellationSchema>,
    user: AuthUser,
    httpRequestId?: string,
  ) {
    if (!user.permissions?.includes(APPROVE_CANCELLATION_PERMISSION)) {
      throw new AuthorizationError('No tienes permiso para revisar cancelaciones.');
    }
    const request = await OrderRepository.findCancellationRequest(requestId);
    if (!request) throw new NotFoundError('Solicitud de cancelación no encontrada.');
    if (request.status !== 'pending') throw businessRuleError('Esta solicitud ya fue revisada.');

    let deletedExpenseDate: Date | null = null;
    await runInTransaction(async (tx) => {
      if (decision === 'approve') {
        deletedExpenseDate = await approveCancellationInTransaction(tx, requestId, request.order, user, comment ?? null);
        return;
      }
      if (!(await OrderRepository.claimCancellationRequest(tx, requestId, { status: 'rejected', reviewedById: user.id, reviewComment: comment ?? null }))) {
        throw businessRuleError('Esta solicitud ya fue revisada.');
      }
      await AuditLogRepository.create({
        userId: user.id,
        action: 'ORDER_CANCELLATION_REJECTED',
        metadata: { orderId: request.orderId, requestId, ...(comment && { comment }) },
      }, tx);
    }, { serializable: true });

    const approved = decision === 'approve';
    auditLog({
      requestId: httpRequestId,
      actor: { id: user.id, name: user.name },
      action: approved ? 'ORDER_CANCELLATION_APPROVED' : 'ORDER_CANCELLATION_REJECTED',
      entity: 'order',
      entityId: request.orderId,
    }, approved ? 'Order cancellation approved' : 'Order cancellation rejected');
    // Assigned inside the transaction callback, which TS flow analysis doesn't track.
    if (approved) await invalidateCancelledSaleSnapshots(request.order, deletedExpenseDate as Date | null);
    await notifySafely(async () => [{ id: request.requestedById }], {
      title: approved ? 'Cancelación aprobada' : 'Cancelación rechazada',
      message: `La cancelación de la venta #${request.order.orderNumber.toString()} fue ${approved ? 'aprobada' : 'rechazada'} por ${user.name}.${comment ? ` Comentario: ${comment}` : ''}`,
      referenceId: request.orderId,
    });
    return OrderRepository.findCancellationRequestSummary(requestId);
  },

  async getPendingPayments(user: AuthUser) {
    if (!user.permissions?.includes('sales.read')) {
      throw new AuthorizationError('No tienes permiso para consultar pagos pendientes.');
    }

    return OrderRepository.findPendingPayments();
  },

  async settlePayment(paymentId: string, settleMethod: 'cash' | 'transfer' | 'card', user: AuthUser, cashReceived?: number) {
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
    const receivedAmount = settleMethod === 'cash' && cashReceived !== undefined ? new Prisma.Decimal(cashReceived) : null;
    if (receivedAmount && receivedAmount.lt(payment.amount)) {
      throw businessRuleError('El monto recibido debe cubrir el pago pendiente.');
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
          receivedAmount,
          changeAmount: receivedAmount ? receivedAmount.sub(payment.amount) : null,
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
          amount: order.deliveryAmount.negated(),
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
    if (order.status === OrderStatus.cancelled) {
      throw businessRuleError('No se puede editar una venta cancelada.');
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
