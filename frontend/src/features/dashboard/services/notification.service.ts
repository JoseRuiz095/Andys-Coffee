import { apiClient } from '@/app/api';
import { NotificationRecipient } from '../types/notification.types';

export const getNotifications = async (): Promise<NotificationRecipient[]> => {
  const response = await apiClient.get<NotificationRecipient[]>('/notifications');
  return response.data;
};

export const markNotificationAsRead = async (notificationId: string): Promise<NotificationRecipient> => {
  const response = await apiClient.patch<NotificationRecipient>(`/notifications/${notificationId}/read`);
  return response.data;
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  await apiClient.post('/notifications/read-all');
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  await apiClient.delete(`/notifications/${notificationId}`);
};

export const deleteAllNotifications = async (): Promise<void> => {
  await apiClient.delete('/notifications');
};
