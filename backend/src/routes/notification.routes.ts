import { Router } from 'express';
import {
	deleteAllNotifications,
	deleteNotification,
	getNotifications,
	markAllAsRead,
	markAsRead,
} from '../controllers/notification.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, getNotifications);
router.delete('/', requireAuth, deleteAllNotifications);
router.patch('/:id/read', requireAuth, markAsRead);
router.post('/read-all', requireAuth, markAllAsRead);
router.delete('/:id', requireAuth, deleteNotification);

export default router;
