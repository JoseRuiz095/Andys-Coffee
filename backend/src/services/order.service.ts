import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  createOrderSchema,
  orderItemExtraSchema,
  orderItemSchema,
} from '../validators/order.validator';
import { prisma } from '../config/prisma';

type CreateOrderInput = z.infer<typeof createOrderSchema>;
type OrderItemInput = z.infer<typeof orderItemSchema>;
type OrderItemExtraInput = z.infer<typeof orderItemExtraSchema>;

export const OrderService = {
  async create(orderData: CreateOrderInput, cashSessionId: string, userId: string) {
    const { items, ...restOfOrder } = orderData;

    // 1. Obtener TODOS los productos, combos y extras de la DB en una sola consulta
    // para asegurar que usamos precios y costos REALES, no los que envía el frontend.
    const productIds = items.map((item: OrderItemInput) => item.productId).filter(Boolean) as string[];
    const comboIds = items.map((item: OrderItemInput) => item.comboId).filter(Boolean) as string[];
    const extraIds = items
      .flatMap((item: OrderItemInput) => item.extras?.map((e: OrderItemExtraInput) => e.extraId) || [])
      .filter(Boolean);

    const [dbProducts, dbCombos, dbExtras] = await Promise.all([
      prisma.product.findMany({ where: { id: { in: productIds } } }),
      prisma.combo.findMany({ where: { id: { in: comboIds } } }),
      prisma.extra.findMany({ where: { id: { in: extraIds } } }),
    ]);

    // Crear mapas para fácil acceso
    const productsMap = new Map(dbProducts.map(p => [p.id, p]));
    const combosMap = new Map(dbCombos.map(c => [c.id, c]));
    const extrasMap = new Map(dbExtras.map(e => [e.id, e]));

    // Iniciar la transacción
    return prisma.$transaction(async (tx) => {
      let totalOrderCost = new Prisma.Decimal(0);
      let totalOrderPrice = new Prisma.Decimal(0);

      // 2. Crear la orden principal
      const order = await tx.order.create({
        data: {
          ...restOfOrder,
          status: 'PENDING',
          createdById: userId,
          cashSessionId: cashSessionId,
          // Los totales se calcularán y actualizarán al final
        },
      });

      // 3. Procesar cada item del pedido
      for (const item of items) {
        const isProduct = !!item.productId;
        const dbEntity = isProduct ? productsMap.get(item.productId!) : combosMap.get(item.comboId!);

        if (!dbEntity) {
          throw new Error(`Producto o combo con ID ${item.productId || item.comboId} no encontrado.`);
        }

        const itemSubtotal = dbEntity.price.mul(item.quantity);
        // Hacemos un type casting porque el modelo Combo puede no tener 'cost'
        const itemCost = ((dbEntity as any).cost ?? new Prisma.Decimal(0)).mul(item.quantity);
        totalOrderPrice = totalOrderPrice.add(itemSubtotal);
        totalOrderCost = totalOrderCost.add(itemCost);

        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            comboId: item.comboId,
            productName: dbEntity.name,
            quantity: item.quantity,
            unitPrice: dbEntity.price,
            subtotal: itemSubtotal,
            costSnapshot: itemCost, // <-- Guardando el costo en el momento de la venta
            notes: item.notes,
          },
        });

        // 4. Procesar los extras de cada item
        if (item.extras && item.extras.length > 0) {
          for (const extraData of item.extras) {
            const dbExtra = extrasMap.get(extraData.extraId);
            if (!dbExtra) throw new Error(`Extra con ID ${extraData.extraId} no encontrado.`);

            const extraSubtotal = dbExtra.price.mul(extraData.quantity);
            const extraCost = (dbExtra.cost ?? new Prisma.Decimal(0)).mul(extraData.quantity);

            totalOrderPrice = totalOrderPrice.add(extraSubtotal);
            totalOrderCost = totalOrderCost.add(extraCost);

            await tx.orderItemExtra.create({
              data: {
                orderItemId: orderItem.id,
                extraId: extraData.extraId,
                extraName: dbExtra.name,
                quantity: extraData.quantity,
                unitPrice: dbExtra.price,
                subtotal: extraSubtotal,
                costSnapshot: extraCost, // <-- Guardando el costo del extra
              },
            });
          }
        }
      }

      // 5. Actualizar la orden con los totales finales
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          subtotal: totalOrderPrice,
          total: totalOrderPrice, // Aquí irían cálculos de impuestos y descuentos
          totalCost: totalOrderCost,
        },
      });

      // Aquí se podría invocar una función de DB para procesar el inventario,
      // o hacerlo directamente en otra transacción.
      // ej: await tx.$executeRaw`SELECT process_order_inventory(${order.id}::uuid)`;

      return updatedOrder;
    });
  },
};