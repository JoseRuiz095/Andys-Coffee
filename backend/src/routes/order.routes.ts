import { Router } from 'express';
import {
    createOrder,
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    getPendingPayments,
    settleOrderPayment,
    getPendingDeliveries,
    handoffOrderDelivery,
    updateOrder,
    getOrdersByDate,
} from '../controllers/order.controller';
import { validate } from '../middleware/validate';
import {
    createOrderSchema,
    updateOrderStatusSchema,
    settlePaymentSchema,
    deliveryHandoffSchema,
    updateOrderSchema,
} from '../validators/order.validator';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';

const router = Router();

router.use(requireAuth);

// Specific routes first (avoid /:id matching /payments/pending, /deliveries/pending or /by-date)
router.get('/payments/pending', checkPermission('sales.read'), getPendingPayments);
router.patch('/payments/:paymentId/settle', checkPermission('sales.create'), validate(settlePaymentSchema), settleOrderPayment);
router.get('/deliveries/pending', checkPermission('sales.read'), getPendingDeliveries);
router.get('/by-date', checkPermission('sales.read'), getOrdersByDate);

// No route-level permission: the service scopes by ownership (users without sales.read
// only see / touch their own orders) and, for status changes, the permission depends on
// the target status (sales.create to advance, sales.cancel to cancel).
router.get('/', getAllOrders);
router.get('/:id', getOrderById);
router.patch('/:id/status', validate(updateOrderStatusSchema), updateOrderStatus);

router.post('/', checkPermission('sales.create'), validate(createOrderSchema), createOrder);
router.patch('/:id/delivery/handoff', checkPermission('sales.create'), validate(deliveryHandoffSchema), handoffOrderDelivery);
router.patch('/:id', checkPermission('sales.update'), validate(updateOrderSchema), updateOrder);

export default router;
