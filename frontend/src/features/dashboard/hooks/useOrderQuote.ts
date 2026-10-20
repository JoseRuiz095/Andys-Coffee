import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { quoteOrder } from '../../orders/services/order.service'
import type { CreateOrderItem } from '../types/order.types'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'

const QUOTE_DEBOUNCE_MS = 300

/**
 * Server pricing of the cart, so the POS shows the total that will actually be charged
 * (promotions included). `isCurrent` is false while the cart changed and the new price is not
 * back yet: the screen must not charge cash against a stale total in that window.
 */
export function useOrderQuote(items: CreateOrderItem[]) {
  const cartKey = JSON.stringify(items)
  const debouncedKey = useDebouncedValue(cartKey, QUOTE_DEBOUNCE_MS)

  const query = useQuery({
    queryKey: ['orderQuote', debouncedKey],
    queryFn: () => quoteOrder(JSON.parse(debouncedKey) as CreateOrderItem[]),
    enabled: items.length > 0 && debouncedKey === cartKey,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  })

  const isCurrent = items.length > 0 && debouncedKey === cartKey && query.isSuccess && !query.isPlaceholderData
  return {
    quote: isCurrent ? query.data : undefined,
    /** Last known pricing, possibly for a previous version of the cart. */
    lastQuote: items.length > 0 ? query.data : undefined,
    isCurrent,
    error: debouncedKey === cartKey ? query.error : null,
  }
}
