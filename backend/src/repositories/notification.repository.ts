import type { NotificationType } from '@prisma/client';
import { prisma } from '../config/prisma';

export const NotificationRepository = {
  /** Creates a notification and one recipient row per user. */
  async createForRecipients(
    data: { title: string; message: string; type: NotificationType; referenceId?: string },
    recipientIds: string[],
  ) {
    const notification = await prisma.notification.create({ data });
    await prisma.notificationRecipient.createMany({
      data: recipientIds.map((userId) => ({ notificationId: notification.id, userId })),
    });
    return notification;
  },

  /** Most recent notifications of a user (bounded: the list otherwise grows forever). */
  async findForUser(userId: string, limit = 200) {
    return prisma.notificationRecipient.findMany({
      where: { userId },
      include: { notification: true },
      orderBy: { notification: { createdAt: 'desc' } },
      take: limit,
    });
  },

  async markAsRead(notificationId: string, userId: string) {
    return prisma.notificationRecipient.update({
      where: { notificationId_userId: { notificationId, userId } },
      data: { readAt: new Date() },
    });
  },

  async markAllAsRead(userId: string) {
    return prisma.notificationRecipient.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  },

  async deleteForUser(notificationId: string, userId: string) {
    return prisma.notificationRecipient.delete({
      where: { notificationId_userId: { notificationId, userId } },
    });
  },

  async deleteAllForUser(userId: string) {
    return prisma.notificationRecipient.deleteMany({ where: { userId } });
  },
};
