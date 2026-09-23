import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { NotificationType } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient;

type NotificationData = {
  title: string;
  message: string;
  type: NotificationType;
  referenceId?: string;
};

export const NotificationService = {
  /**
   * Creates a notification and links it to specified recipients.
   * @param data - The notification content.
   * @param recipientIds - An array of user IDs to receive the notification.
   * @param tx - Optional Prisma transaction client.
   */
  async createNotification(
    data: NotificationData,
    recipientIds: string[],
    tx?: TransactionClient
  ) {
    if (recipientIds.length === 0) {
      return;
    }
    const db = tx || prisma;

    const notification = await db.notification.create({
      data: {
        title: data.title,
        message: data.message,
        type: data.type,
        referenceId: data.referenceId,
      },
    });

    const recipientData = recipientIds.map((userId) => ({
      notificationId: notification.id,
      userId: userId,
    }));

    await db.notificationRecipient.createMany({
      data: recipientData,
    });

    return notification;
  },

  /**
   * Retrieves all notifications for a specific user, ordered by creation date.
   * @param userId - The ID of the user.
   * @param tx - Optional Prisma transaction client.
   */
  async getNotificationsForUser(userId: string, tx?: TransactionClient) {
    const db = tx || prisma;
    return db.notificationRecipient.findMany({
      where: { userId },
      include: {
        notification: true,
      },
      orderBy: {
        notification: {
          createdAt: 'desc',
        },
      },
      // Bounded to the most recent notifications; this list otherwise grows
      // unbounded for the lifetime of the account.
      take: 200,
    });
  },

  /**
   * Marks a specific notification as read for a specific user.
   * @param notificationId - The ID of the notification.
   * @param userId - The ID of the user.
   * @param tx - Optional Prisma transaction client.
   */
  async markAsRead(notificationId: string, userId: string, tx?: TransactionClient) {
    const db = tx || prisma;
    return db.notificationRecipient.update({
      where: {
        notificationId_userId: {
          notificationId,
          userId,
        },
      },
      data: {
        readAt: new Date(),
      },
    });
  },

  /**
   * Marks all unread notifications as read for a specific user.
   * @param userId - The ID of the user.
   * @param tx - Optional Prisma transaction client.
   */
  async markAllAsRead(userId: string, tx?: TransactionClient) {
    const db = tx || prisma;
    return db.notificationRecipient.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  },

  async deleteForUser(notificationId: string, userId: string, tx?: TransactionClient) {
    const db = tx || prisma;
    return db.notificationRecipient.delete({
      where: {
        notificationId_userId: {
          notificationId,
          userId,
        },
      },
    });
  },

  async deleteAllForUser(userId: string, tx?: TransactionClient) {
    const db = tx || prisma;
    return db.notificationRecipient.deleteMany({
      where: { userId },
    });
  },
};

