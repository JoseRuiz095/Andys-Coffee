import React from 'react';
import { motion } from 'framer-motion';
import { XIcon } from '../../../components/ui/XIcon';
import { useNotifications } from '../hooks/useNotifications';
import { CoffeeIcon } from '@/components/ui/coffee';
import { IngredientIcon } from '@/components/ui/IngredientIcon';
import { Spinner } from '@/shared/components/Spinner';
import { useOverlayEscape } from '@/shared/hooks/useOverlayEscape';

interface NotificationCenterProps {
  onClose: () => void;
}

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return `hace ${seconds}s`;
  if (minutes < 60) return `hace ${minutes}m`;
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${days}d`;
};

const NotificationIcon = ({ type }: { type: string }) => {
  const icon = type === 'NEW_ORDER' ? (
    <CoffeeIcon className="flex h-5 w-5 items-center justify-center" size={18} style={{ color: 'var(--color-primary)' }} />
  ) : type === 'LOW_STOCK' ? (
    // Ingredient at its minimum or out of stock (plan F6).
    <IngredientIcon size={18} style={{ color: 'var(--color-warning)' }} aria-label="Stock bajo" />
  ) : (
    <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>!</span>
  );

  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border p-0"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-surface))' }}
    >
      {icon}
    </div>
  );
};

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6m4-6v6M9 7V4h6v3m-9 0 1 13h8l1-13" />
  </svg>
);

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
  const {
    notifications,
    isLoading,
    isError,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    isUpdating,
  } = useNotifications();
  // Deleting everything can't be undone: the footer asks once more, inline (a dialog would sit
  // outside the popover and its first click would close it).
  const [isConfirmingDeleteAll, setIsConfirmingDeleteAll] = React.useState(false);
  useOverlayEscape(true, onClose);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-label="Notificaciones"
      className="absolute right-0 top-16 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-[1.25rem] border shadow-[var(--shadow-popover)]"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Notificaciones</h3>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Alertas recientes del sistema.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar notificaciones"
          className="flex h-8 w-8 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-primary)_25%,transparent)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <XIcon size={20} />
        </button>
      </div>
      <div className="max-h-96 divide-y overflow-y-auto" style={{ borderColor: 'var(--color-border)' }}>
        {isLoading ? (
          <div className="flex items-center justify-center p-10">
            <Spinner />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-sm text-[var(--color-danger)]">
            Error al cargar notificaciones.
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[var(--color-text-secondary)]">
            No hay nuevas notificaciones
          </div>
        ) : (
          notifications.map(({ notification, readAt }) => (
            <div
              key={notification.id}
              className="flex items-start gap-3 px-5 py-4 transition-colors"
              style={{
                backgroundColor: !readAt ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-surface))' : 'var(--color-surface)',
              }}
            >
              <NotificationIcon type={notification.type} />
              <button
                type="button"
                className="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[color-mix(in_srgb,var(--color-primary)_25%,transparent)]"
                onClick={() => !readAt && !isUpdating && markAsRead(notification.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{notification.title}</span>
                  {!readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />}
                </div>
                <p className="mt-1 text-sm leading-5" style={{ color: 'var(--color-text-secondary)' }}>{notification.message}</p>
                <div className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatTimeAgo(notification.createdAt)}</div>
              </button>
              <button
                type="button"
                aria-label={`Eliminar notificación: ${notification.title}`}
                title="Eliminar notificación"
                onClick={() => deleteNotification(notification.id)}
                disabled={isUpdating}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-danger)_25%,transparent)]"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <TrashIcon />
              </button>
            </div>
          ))
        )}
      </div>
      {notifications.length > 0 && (
        <div className="border-t px-4 py-3 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          {isConfirmingDeleteAll ? (
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm" role="alert">
              <span style={{ color: 'var(--color-text-primary)' }}>¿Eliminar todas las notificaciones?</span>
              <button
                type="button"
                onClick={() => deleteAllNotifications(undefined, { onSuccess: () => setIsConfirmingDeleteAll(false) })}
                disabled={isUpdating}
                className="font-semibold transition hover:underline disabled:opacity-50"
                style={{ color: 'var(--color-danger)' }}
              >
                Eliminar
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDeleteAll(false)}
                disabled={isUpdating}
                className="font-medium transition hover:underline disabled:opacity-50"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="text-sm font-medium transition hover:underline disabled:no-underline disabled:opacity-60"
                style={{ color: 'var(--color-primary)' }}
                disabled={isUpdating || notifications.every((notification) => notification.readAt)}
              >
                Marcar todas como leídas
              </button>
              <span className="h-4 w-px" style={{ backgroundColor: 'var(--color-border)' }} />
              <button
                type="button"
                onClick={() => setIsConfirmingDeleteAll(true)}
                disabled={isUpdating}
                aria-label="Eliminar todas las notificaciones"
                title="Eliminar todas"
                className="flex h-8 w-8 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-danger)_25%,transparent)] disabled:opacity-50"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <TrashIcon />
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
