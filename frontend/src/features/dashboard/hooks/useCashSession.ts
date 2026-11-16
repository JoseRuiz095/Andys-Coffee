import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { closeCashSession, getActiveCashSession, openCashSession } from '../services/cash.service'
import { invalidateMoneyAndStockQueries } from '../../../shared/utils/queryInvalidation'

const cashSessionQueryKey = ['cash-session', 'active']

/** `enabled: false` for users without cash.open, who can't read the active session (403). */
export function useCashSession({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: cashSessionQueryKey,
    queryFn: getActiveCashSession,
    enabled,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  })
  // Opening or closing the drawer changes the cut history, the cash difference of the day in
  // the income statement and the session the orders belong to, not only the active session.
  const refreshAfterCashChange = () => {
    void invalidateMoneyAndStockQueries(queryClient)
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }
  const openMutation = useMutation({
    mutationFn: openCashSession,
    onSuccess: (session) => {
      queryClient.setQueryData(cashSessionQueryKey, session)
      refreshAfterCashChange()
    },
  })
  const closeMutation = useMutation({
    mutationFn: closeCashSession,
    onSuccess: () => {
      queryClient.setQueryData(cashSessionQueryKey, null)
      refreshAfterCashChange()
    },
  })

  return { ...query, openSession: openMutation, closeSession: closeMutation }
}
