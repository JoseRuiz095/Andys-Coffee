import React from 'react';
import { motion } from 'framer-motion';
import { XIcon } from '../../../components/ui/XIcon';

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
}

const initialNotifications: Notification[] = [
  { id: '1', title: 'New Order #354', description: 'A new order has been placed.', time: '2m ago' },
  { id: '2', title: 'Order #351 Completed', description: 'Order #351 has been marked as completed.', time: '1h ago' },
  { id: '3', title: 'Low Stock Warning', description: 'Item "Leche" is running low on stock.', time: '3h ago' },
];

interface NotificationCenterProps {
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
  const [notifications, setNotifications] = React.useState<Notification[]>(initialNotifications);

  const handleRemoveNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.2 }}
      className="absolute top-16 right-0 mt-2 w-80 bg-white rounded-lg border border-gray-200 shadow-lg z-50 origin-top-right"
    >
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-lg">Notificaciones</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <XIcon size={20} />
        </button>
      </div>
      <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No hay nuevas notificaciones</div>
        ) : (
          notifications.map(notification => (
            <div key={notification.id} className="p-4 hover:bg-gray-50 flex justify-between items-start">
              <div>
                <div className="font-semibold">{notification.title}</div>
                <p className="text-sm text-gray-600">{notification.description}</p>
                <div className="text-xs text-gray-400 mt-1">{notification.time}</div>
              </div>
              <button
                onClick={() => handleRemoveNotification(notification.id)}
                className="ml-2 text-gray-400 hover:text-red-500"
                aria-label="Remove notification"
              >
                <XIcon size={16} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="p-2 text-center border-t border-gray-200">
        <button onClick={() => setNotifications([])} className="text-sm text-blue-500 hover:underline">Clear all</button>
      </div>
    </motion.div>
  );
};
