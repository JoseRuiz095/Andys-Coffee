import { Router } from 'express';
import { createOrder, getAllOrders, getOrderById, updateOrderStatus } from '../controllers/order.controller';
import { validate } from '../middleware/validate';
import { createOrderSchema, updateOrderStatusSchema } from '../validators/order.validator';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, getAllOrders);
router.get('/:id', requireAuth, getOrderById);
router.post('/', requireAuth, validate(createOrderSchema), createOrder);
router.patch('/:id/status', requireAuth, validate(updateOrderStatusSchema), updateOrderStatus);

export default router;
