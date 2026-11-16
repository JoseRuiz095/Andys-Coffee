import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sileo } from 'sileo';
import { getErrorMessage } from '../../../shared/utils/errors';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
} from '../services/notification.service';

export function useNotifications() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const notifyError = (fallback: string) => (error: unknown) =>
    sileo.error({ title: 'Notificaciones', description: getErrorMessage(error, fallback) });

  const {
    data: notifications,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const markAsReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: refresh,
    onError: notifyError('No se pudo marcar como leída.'),
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: refresh,
    onError: notifyError('No se pudieron marcar como leídas.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: refresh,
    onError: notifyError('No se pudo eliminar la notificación.'),
  });

  const deleteAllMutation = useMutation({
    mutationFn: deleteAllNotifications,
    onSuccess: refresh,
    onError: notifyError('No se pudieron eliminar las notificaciones.'),
  });

  return {
    notifications: notifications ?? [],
    unreadCount: notifications?.filter((n) => !n.readAt).length ?? 0,
    isLoading,
    isError,
    error,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteNotification: deleteMutation.mutate,
    deleteAllNotifications: deleteAllMutation.mutate,
    /** True while any change is being sent: the buttons are disabled meanwhile. */
    isUpdating:
      markAsReadMutation.isPending || markAllAsReadMutation.isPending || deleteMutation.isPending || deleteAllMutation.isPending,
  };
}
