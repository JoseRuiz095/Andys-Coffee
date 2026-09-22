import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PendingPaymentsAPI, type SettleMethod } from '../api/pending-payments.api';
import { sileo } from 'sileo';
import { invalidateMoneyAndStockQueries } from '../../../shared/utils/queryInvalidation';

const QUERY_KEY = 'pendingPayments';

export function usePendingPayments() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => PendingPaymentsAPI.getPendingPayments(),
  });
}

export function useSettlePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ paymentId, method }: { paymentId: string; method: SettleMethod }) =>
      PendingPaymentsAPI.settlePayment(paymentId, method),
    onSuccess: () => {
      void invalidateMoneyAndStockQueries(queryClient);
      sileo.success({ title: 'Pago liquidado', description: 'El pago pendiente se marcó como cobrado.' });
    },
    onError: (error: any) => {
      sileo.error({
        title: 'Error',
        description: error?.response?.data?.message ?? 'No se pudo liquidar el pago.',
      });
    },
  });
}
