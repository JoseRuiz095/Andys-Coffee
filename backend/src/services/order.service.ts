import { OrderStatus, Prisma, Promotion, PromotionType, NotificationType } from '@prisma/client';
import { z } from 'zod';
import {
  createOrderSchema,
  filterQuerySchema,
  orderItemExtraSchema,
  orderItemSchema,
  updateOrderStatusSchema,
} from '../validators/order.validator';
import { prisma } from '../config/prisma';
import { NotificationService } from './notification.service';

type CreateOrderInput = z.infer<typeof createOrderSchema>;
type OrderItemInput = z.infer<typeof orderItemSchema>;
type OrderItemExtraInput = z.infer<typeof orderItemExtraSchema>;

// Helper function to apply promotions
async function applyPromotions(
  orderItems: (Prisma.OrderItemGetPayload<{ include: { product: true } }>)[],
  promotions: (Prisma.PromotionGetPayload<{ include: { products: true, categories: true } }>)[],
) {
  const discounts: { orderItemId: string; amount: Prisma.Decimal }[] = [];
  const processedQuantities = new Map<string, number>(); // Tracks processed quantity per orderItem.id

  for (const promo of promotions) {
    const eligiblePromoItems = orderItems
      .filter(item => {
        if (!item.productId || item.sourceComboId) return false; // Must be a product, not from a combo
        const isProductMatch = promo.products.some(p => p.productId === item.productId);
        const isCategoryMatch = item.product && promo.categories.some(c => c.categoryId === item.product.categoryId);
        return isProductMatch || isCategoryMatch;
      });

    let availableIndividualItems = eligiblePromoItems.flatMap(item => {
      const processedQty = processedQuantities.get(item.id) ?? 0;
      const availableQty = item.quantity.toNumber() - processedQty;
      return Array(availableQty > 0 ? availableQty : 0).fill(item);
    });
    
    availableIndividualItems.sort((a, b) => b.unitPrice.comparedTo(a.unitPrice));

    switch (promo.type) {
      case PromotionType.FIXED_PRICE:
        for (const item of availableIndividualItems) {
          const originalPrice = item.unitPrice;
          const promotionalPrice = promo.discountValue;
          if (originalPrice.gt(promotionalPrice)) {
            const discountAmount = originalPrice.sub(promotionalPrice);
            discounts.push({ orderItemId: item.id, amount: discountAmount });
            
            const processed = processedQuantities.get(item.id) ?? 0;
            processedQuantities.set(item.id, processed + 1);
          }
        }
        break;

      case PromotionType.BOGO:
      case PromotionType.MULTIBUY_FIXED_PRICE: {
        const buyQty = promo.buyQuantity ?? 1;
        const getQty = promo.type === PromotionType.BOGO ? (promo.getQuantity ?? 1) : 0;
        const groupSize = promo.type === PromotionType.BOGO ? buyQty + getQty : buyQty;
        
        if (groupSize <= 0) continue;

        while (availableIndividualItems.length >= groupSize) {
          const group = availableIndividualItems.splice(0, groupSize);

          group.forEach(item => {
            const processed = processedQuantities.get(item.id) ?? 0;
            processedQuantities.set(item.id, processed + 1);
          });

          if (promo.type === PromotionType.BOGO) {
            const itemsToDiscount = group.slice(-getQty);
            for (const itemToDiscount of itemsToDiscount) {
              const discountPercentage = promo.discountValue.div(100);
              const discountAmount = itemToDiscount.unitPrice.mul(discountPercentage);
              discounts.push({ orderItemId: itemToDiscount.id, amount: discountAmount });
            }
          } else if (promo.type === PromotionType.MULTIBUY_FIXED_PRICE) {
            const groupOriginalPrice = group.reduce((sum, item) => sum.add(item.unitPrice), new Prisma.Decimal(0));
            const groupPromotionalPrice = promo.discountValue;

            if (groupOriginalPrice.gt(groupPromotionalPrice)) {
              const totalGroupDiscount = groupOriginalPrice.sub(groupPromotionalPrice);
              const lastItem = group[group.length - 1];
              discounts.push({ orderItemId: lastItem.id, amount: totalGroupDiscount });
            }
          }
        }
        break;
      }
    }
  }

  // Aggregate discounts per order item id
  const aggregatedDiscounts = new Map<string, Prisma.Decimal>();
  for (const discount of discounts) {
    const existing = aggregatedDiscounts.get(discount.orderItemId) ?? new Prisma.Decimal(0);
    aggregatedDiscounts.set(discount.orderItemId, existing.add(discount.amount));
  }

  return Array.from(aggregatedDiscounts.entries()).map(([orderItemId, amount]) => ({
    orderItemId,
    amount,
  }));
}


export const OrderService = {
  async findAll(query: z.infer<typeof filterQuerySchema>) {
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

  async findOne(id: string) {
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

  async updateStatus(id: string, data: z.infer<typeof updateOrderStatusSchema>) {
    const { status } = data;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new Error('Order not found');
    }

    const updateData: Prisma.OrderUpdateInput = { status };
    if (status === OrderStatus.completed || status === OrderStatus.cancelled) {
      updateData.completedAt = new Date();
    }

    return prisma.order.update({
      where: { id },
      data: updateData,
    });
  },

  async create(orderData: CreateOrderInput, userId: string) {
    const { items, paymentMethod, ...restOfOrder } = orderData;
    const today = new Date();
    const currentDay = today.getDay();

    const productIds = items.map(item => item.productId).filter(Boolean) as string[];
    const comboIds = items.map(item => item.comboId).filter(Boolean) as string[];
    const extraIds = items.flatMap(item => item.extras?.map(e => e.extraId) || []).filter(Boolean);

    const [dbProducts, dbCombosWithItems, dbExtras, activePromotions] = await Promise.all([
      prisma.product.findMany({ where: { id: { in: productIds } } }),
      prisma.combo.findMany({
        where: { id: { in: comboIds }, isActive: true, OR: [{ activeOnDays: { isEmpty: true } }, { activeOnDays: { has: currentDay } }] },
        include: { items: { include: { product: true } } },
      }),
      prisma.extra.findMany({ where: { id: { in: extraIds } } }),
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

    return prisma.$transaction(async (tx) => {
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
          ...restOfOrder,
          customerName: finalCustomerName,
          status: 'pending',
          createdById: userId
        },
      });

      const createdOrderItems = [];

      for (const item of items) {
        if (item.productId) {
          const dbProduct = productsMap.get(item.productId);
          if (!dbProduct) throw new Error(`Producto con ID ${item.productId} no encontrado.`);

          const itemSubtotal = dbProduct.price.mul(item.quantity);
          const itemCost = (dbProduct.cost ?? new Prisma.Decimal(0)).mul(item.quantity);
          subtotal = subtotal.add(itemSubtotal);
          totalOrderCost = totalOrderCost.add(itemCost);

          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: dbProduct.id,
              productName: dbProduct.name,
              quantity: item.quantity,
              unitPrice: dbProduct.price,
              subtotal: itemSubtotal,
              costSnapshot: itemCost,
              notes: item.note,
            },
            include: { product: true }
          });
          createdOrderItems.push(orderItem);

          if (item.extras) {
            for (const extraData of item.extras) {
              const dbExtra = extrasMap.get(extraData.extraId);
              if (!dbExtra) throw new Error(`Extra con ID ${extraData.extraId} no encontrado.`);
              const extraSubtotal = dbExtra.price.mul(extraData.quantity);
              subtotal = subtotal.add(extraSubtotal);
              totalOrderCost = totalOrderCost.add((dbExtra.cost ?? new Prisma.Decimal(0)).mul(extraData.quantity));
              await tx.orderItemExtra.create({
                data: {
                  orderItemId: orderItem.id,
                  extraId: extraData.extraId,
                  extraName: dbExtra.name,
                  quantity: extraData.quantity,
                  unitPrice: dbExtra.price,
                  subtotal: extraSubtotal,
                },
              });
            }
          }
        } else if (item.comboId) {
          const dbCombo = combosMap.get(item.comboId);
          if (!dbCombo) throw new Error(`Combo con ID ${item.comboId} no encontrado o no está activo para hoy.`);
          
          subtotal = subtotal.add(dbCombo.price.mul(item.quantity));

          for (const comboItem of dbCombo.items) {
            const productCost = (comboItem.product.cost ?? new Prisma.Decimal(0)).mul(comboItem.quantity).mul(item.quantity);
            totalOrderCost = totalOrderCost.add(productCost);
            const orderItem = await tx.orderItem.create({
              data: {
                orderId: order.id,
                productId: comboItem.productId,
                productName: `${comboItem.product.name} (Combo: ${dbCombo.name})`,
                quantity: new Prisma.Decimal(comboItem.quantity).mul(item.quantity),
                unitPrice: 0,
                subtotal: 0,
                costSnapshot: productCost,
                sourceComboId: dbCombo.id,
                notes: item.note,
              },
              include: { product: true }
            });
            createdOrderItems.push(orderItem);
          }
        }
      }

      // Apply promotions
      const itemDiscounts = await applyPromotions(createdOrderItems, activePromotions);
      let totalDiscount = new Prisma.Decimal(0);

      for (const discount of itemDiscounts) {
        totalDiscount = totalDiscount.add(discount.amount);
        await tx.orderItem.update({
          where: { id: discount.orderItemId },
          data: {
            discount: discount.amount,
            subtotal: {
              decrement: discount.amount,
            },
          },
        });
      }

      const finalTotal = subtotal.sub(totalDiscount);

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          subtotal: subtotal,
          discount: totalDiscount,
          total: finalTotal,
          totalCost: totalOrderCost,
        },
        include: { items: { include: { extras: true } } },
      });

      if (paymentMethod) {
        await tx.payment.create({
          data: {
            orderId: order.id,
            method: paymentMethod,
            amount: finalTotal,
            createdById: userId,
          },
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
    });
  },
};
