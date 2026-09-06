import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { closeCashSession, getActiveCashSession, openCashSession } from '../services/cash.service'

const cashSessionQueryKey = ['cash-session', 'active']

export function useCashSession() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: cashSessionQueryKey,
    queryFn: getActiveCashSession,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    retry: 1,
  })
  const openMutation = useMutation({
    mutationFn: openCashSession,
    onSuccess: (session) => {
      queryClient.setQueryData(cashSessionQueryKey, session)
      void queryClient.invalidateQueries({ queryKey: cashSessionQueryKey })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  const closeMutation = useMutation({
    mutationFn: closeCashSession,
    onSuccess: () => {
      queryClient.setQueryData(cashSessionQueryKey, null)
      void queryClient.invalidateQueries({ queryKey: cashSessionQueryKey })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return { ...query, openSession: openMutation, closeSession: closeMutation }
}
