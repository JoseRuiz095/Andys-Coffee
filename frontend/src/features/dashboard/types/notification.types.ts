export type NotificationType = 'GENERAL' | 'NEW_ORDER' | 'LOW_STOCK';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  referenceId: string | null;
  createdAt: string;
}

export interface NotificationRecipient {
  notificationId: string;
  userId: string;
  readAt: string | null;
  notification: Notification;
}
