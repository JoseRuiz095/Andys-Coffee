import type { NotificationType } from '@prisma/client';
import { NotificationRepository } from '../repositories/notification.repository';

type NotificationData = {
  title: string;
  message: string;
  type: NotificationType;
  referenceId?: string;
};

export const NotificationService = {
  /**
   * Creates a notification for the given users. Callers dispatch it after their own
   * transaction commits, so it never takes part in (or conflicts with) that transaction.
   */
  async createNotification(data: NotificationData, recipientIds: string[]) {
    if (recipientIds.length === 0) {
      return;
    }
    return NotificationRepository.createForRecipients(data, recipientIds);
  },

  /** Notifications of a user, newest first. Every operation is scoped to the user's own rows. */
  async getNotificationsForUser(userId: string) {
    return NotificationRepository.findForUser(userId);
  },

  async markAsRead(notificationId: string, userId: string) {
    return NotificationRepository.markAsRead(notificationId, userId);
  },

  async markAllAsRead(userId: string) {
    return NotificationRepository.markAllAsRead(userId);
  },

  async deleteForUser(notificationId: string, userId: string) {
    return NotificationRepository.deleteForUser(notificationId, userId);
  },

  async deleteAllForUser(userId: string) {
    return NotificationRepository.deleteAllForUser(userId);
  },
};
