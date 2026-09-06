import React from 'react';
import { motion } from 'framer-motion';
import { XIcon } from '../../../components/ui/XIcon';
import { useNotifications } from '../hooks/useNotifications';
import { CoffeeIcon } from '@/components/ui/coffee';
import { Spinner } from '@/shared/components/Spinner';

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
    <CoffeeIcon className="flex h-5 w-5 items-center justify-center text-[#5A804F]" size={18} />
  ) : (
    <span className="text-sm font-bold text-[#8A4E18]">!</span>
  );

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D9E3D6] bg-[#EEF4EB] p-0">
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
  } = useNotifications();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.2 }}
      className="absolute right-0 top-16 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-[1.25rem] border border-[#E7E3DC] bg-[#FDFBF7] shadow-[0_20px_50px_rgba(45,33,29,0.14)]"
    >
      <div className="flex items-center justify-between border-b border-[#E7E3DC] px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold text-[#2C211D]">Notificaciones</h3>
          <p className="mt-0.5 text-xs text-[#7C716B]">
            Alertas recientes del sistema.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar notificaciones"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#8C817B] transition hover:bg-[#F2EFE8] hover:text-[#2C211D] focus:outline-none focus:ring-2 focus:ring-[#5A804F]/25"
        >
          <XIcon size={20} />
        </button>
      </div>
      <div className="max-h-96 divide-y divide-[#E7E3DC] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-10">
            <Spinner />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-sm text-[#B04A3A]">
            Error al cargar notificaciones.
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[#7C716B]">
            No hay nuevas notificaciones
          </div>
        ) : (
          notifications.map(({ notification, readAt }) => (
            <div
              key={notification.id}
              className={`flex items-start gap-3 px-5 py-4 transition-colors ${!readAt ? 'bg-[#F3E8D6]' : 'bg-[#FDFBF7] hover:bg-[#F2EFE8]'}`}
            >
              <NotificationIcon type={notification.type} />
              <button
                type="button"
                className="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#5A804F]/25"
                onClick={() => !readAt && markAsRead(notification.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold text-[#2C211D]">{notification.title}</span>
                  {!readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#C78234]" />}
                </div>
                <p className="mt-1 text-sm leading-5 text-[#6B625D]">{notification.message}</p>
                <div className="mt-2 text-xs text-[#9A8F88]">{formatTimeAgo(notification.createdAt)}</div>
              </button>
              <button
                type="button"
                aria-label={`Eliminar notificación: ${notification.title}`}
                title="Eliminar notificación"
                onClick={() => deleteNotification(notification.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#A7958A] transition hover:bg-[#F7E4DE] hover:text-[#B04A3A] focus:outline-none focus:ring-2 focus:ring-[#B04A3A]/25"
              >
                <TrashIcon />
              </button>
            </div>
          ))
        )}
      </div>
      {notifications.length > 0 && (
        <div className="border-t border-[#E7E3DC] bg-[#F2EFE8] px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => markAllAsRead()}
              className="text-sm font-medium text-[#5A804F] transition hover:text-[#486B3E] hover:underline disabled:text-[#A7A09B] disabled:no-underline"
              disabled={notifications.every((notification) => notification.readAt)}
            >
              Marcar todas como leídas
            </button>
            <span className="h-4 w-px bg-[#D8CEC5]" />
            <button
              type="button"
              onClick={() => deleteAllNotifications()}
              aria-label="Eliminar todas las notificaciones"
              title="Eliminar todas"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#A7958A] transition hover:bg-[#F7E4DE] hover:text-[#B04A3A] focus:outline-none focus:ring-2 focus:ring-[#B04A3A]/25"
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
