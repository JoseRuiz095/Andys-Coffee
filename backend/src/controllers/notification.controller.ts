import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { NotificationService } from '../services/notification.service';

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const notifications = await NotificationService.getNotificationsForUser(userId);
  res.status(200).json(notifications);
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const { id } = req.params;
  if (typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid notification id' });
  }

  const notification = await NotificationService.markAsRead(id, userId);
  res.status(200).json(notification);
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
  
    await NotificationService.markAllAsRead(userId);
    res.status(204).send();
  });

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const { id } = req.params;
  if (typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid notification id' });
  }

  await NotificationService.deleteForUser(id, userId);
  res.status(204).send();
});

export const deleteAllNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  await NotificationService.deleteAllForUser(userId);
  res.status(204).send();
});
