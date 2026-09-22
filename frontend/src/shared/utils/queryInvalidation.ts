import type { QueryClient } from '@tanstack/react-query'

/**
 * Query roots affected when money or stock moves: a sale, a cancellation, a settled
 * payment, a delivery handoff or a cash expense all change the drawer's expected cash,
 * the income statement and (for sales) inventory, not just the list the user acted on.
 */
const MONEY_AND_STOCK_QUERY_ROOTS = [
  'orders',
  'dailyOrders',
  'pendingPayments',
  'pendingDeliveries',
  'cash-session',
  'cash-sessions-history',
  'incomeStatement',
  'dashboard',
  'inventory',
  'expenses',
] as const

export function invalidateMoneyAndStockQueries(queryClient: QueryClient) {
  return Promise.all(
    MONEY_AND_STOCK_QUERY_ROOTS.map((root) => queryClient.invalidateQueries({ queryKey: [root] })),
  )
}
