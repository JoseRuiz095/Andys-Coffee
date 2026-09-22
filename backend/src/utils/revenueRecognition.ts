import type { Prisma } from '@prisma/client';

/**
 * Revenue recognition rule (business decision R-02, docs/auditoria-mvp-2026-09-22.md):
 * a sale counts as revenue once it is paid, whatever its kitchen status
 * (pending/preparing/ready/completed). Cancelled orders never count.
 * Reports must use these filters so sales, cash and the income statement agree.
 */

/** Order status filter shared by every revenue query: cancelled sales never count. */
export const recognizedOrderStatus: Prisma.EnumOrderStatusFilter = { not: 'cancelled' };

/** Orders that count as sales: not cancelled and with at least one paid payment. */
export const recognizedSaleOrderWhere: Prisma.OrderWhereInput = {
  status: recognizedOrderStatus,
  payments: { some: { status: 'paid' } },
};
