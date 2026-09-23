import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { promotionScopeSelect } from './menu.repository';
import type { DbClient, Tx } from './transaction';

const orderWithItemsInclude = { items: { include: { extras: true } }, payments: true } satisfies Prisma.OrderInclude;

export const OrderRepository = {
  async findWithPagination(where: Prisma.OrderWhereInput, skip: number, limit: number) {
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

    return { orders, total };
  },

  async findById(id: string) {
    return prisma.order.findUnique({
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
  },

  /** Bare order row (no relations). */
  async findPlain(id: string, client: DbClient = prisma) {
    return client.order.findUnique({ where: { id } });
  },

  async findStatus(tx: Tx, id: string) {
    return tx.order.findUnique({ where: { id }, select: { status: true } });
  },

  async findByIdempotencyKey(createdById: string, idempotencyKey: string, client: DbClient = prisma) {
    return client.order.findFirst({ where: { createdById, idempotencyKey }, include: orderWithItemsInclude });
  },

  /**
   * Everything a sale needs to be priced, read inside the sale's transaction so Serializable
   * isolation covers prices, availability and promotions against concurrent changes.
   */
  async loadSaleCatalog(
    tx: Tx,
    params: { productIds: string[]; comboIds: string[]; extraIds: string[]; businessDate: Date; weekday: number },
  ) {
    const { productIds, comboIds, extraIds, businessDate, weekday } = params;
    const activeToday = [{ activeOnDays: { isEmpty: true } }, { activeOnDays: { has: weekday } }];
    const [products, combos, extras, productExtras, promotions] = await Promise.all([
      tx.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true, name: true, categoryId: true, price: true, cost: true },
      }),
      tx.combo.findMany({
        where: {
          id: { in: comboIds },
          isActive: true,
          items: { every: { product: { isActive: true } } },
          OR: activeToday,
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
        where: { OR: productIds.flatMap((productId) => extraIds.map((extraId) => ({ productId, extraId }))) },
      }),
      tx.promotion.findMany({
        where: {
          isActive: true,
          startDate: { lte: businessDate },
          endDate: { gte: businessDate },
          OR: activeToday,
        },
        select: { id: true, type: true, discountValue: true, buyQuantity: true, getQuantity: true, ...promotionScopeSelect },
      }),
    ]);
    return { products, combos, extras, productExtras, promotions };
  },

  async findRecipes(tx: Tx, productIds: string[], extraIds: string[]) {
    const [recipes, extraRecipes] = await Promise.all([
      tx.recipe.findMany({ where: { productId: { in: productIds } } }),
      tx.extraRecipe.findMany({ where: { extraId: { in: extraIds } } }),
    ]);
    return { recipes, extraRecipes };
  },

  /** Next "Cliente N" name from the database sequence (unique under concurrency). */
  async nextCustomerName(tx: Tx): Promise<string> {
    const [{ nextNumber }] = await tx.$queryRaw<{ nextNumber: bigint }[]>`
      SELECT nextval('customer_name_sequence') AS "nextNumber"
    `;
    return `Cliente ${nextNumber.toString()}`;
  },

  async create(tx: Tx, data: Prisma.OrderUncheckedCreateInput) {
    return tx.order.create({ data });
  },

  async createItem(tx: Tx, data: Prisma.OrderItemUncheckedCreateInput) {
    return tx.orderItem.create({ data, include: { product: true } });
  },

  async applyItemDiscount(tx: Tx, orderItemId: string, discount: Prisma.Decimal) {
    return tx.orderItem.update({ where: { id: orderItemId }, data: { discount, subtotal: { decrement: discount } } });
  },

  async update(tx: Tx, id: string, data: Prisma.OrderUpdateInput) {
    return tx.order.update({ where: { id }, data });
  },

  async updateWithItems(tx: Tx, id: string, data: Prisma.OrderUpdateInput) {
    return tx.order.update({ where: { id }, data, include: { items: { include: { extras: true } } } });
  },

  /** Marks the delivery as handed off only if it wasn't already (and the order isn't cancelled). */
  async claimDeliveryHandoff(tx: Tx, id: string): Promise<boolean> {
    const claimed = await tx.order.updateMany({
      where: { id, deliveryHandedOff: false, status: { not: 'cancelled' } },
      data: { deliveryHandedOff: true, deliveryHandedOffAt: new Date() },
    });
    return claimed.count === 1;
  },

  async findPendingDeliveries() {
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

  async findCreatedBetween(from: Date, to: Date) {
    return prisma.order.findMany({
      where: { createdAt: { gte: from, lt: to } },
      include: {
        items: { include: { extras: true } },
        payments: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  // --- Payments ---

  async createPayment(tx: Tx, data: Prisma.PaymentUncheckedCreateInput) {
    return tx.payment.create({ data });
  },

  async findPaymentWithOrder(paymentId: string) {
    return prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  },

  async findPayment(tx: Tx, paymentId: string) {
    return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  },

  async findPendingPayments() {
    return prisma.payment.findMany({
      where: { status: 'pending', order: { status: { not: 'cancelled' } } },
      include: {
        order: { select: { orderNumber: true, customerName: true, total: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  /** Marks a pending payment as paid only if it still is (concurrent settles can't both win). */
  async claimPendingPayment(tx: Tx, paymentId: string, method: string): Promise<boolean> {
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: 'pending', order: { status: { not: 'cancelled' } } },
      data: { status: 'paid', method, paidAt: new Date() },
    });
    return claimed.count === 1;
  },

  /** Cancels the paid and pending payments of an order. */
  async cancelPayments(tx: Tx, orderId: string) {
    return tx.payment.updateMany({
      where: { orderId, status: { in: ['paid', 'pending'] } },
      data: { status: 'cancelled' },
    });
  },
};
