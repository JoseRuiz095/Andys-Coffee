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
} from '../controllers/order.controller';
import { validate } from '../middleware/validate';
import { createOrderSchema, updateOrderStatusSchema, settlePaymentSchema, deliveryHandoffSchema } from '../validators/order.validator';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';

const router = Router();

// Routes are protected by authentication and specific permissions

// Specific routes first (avoid /:id matching /payments/pending or /deliveries/pending)
router.get(
    '/payments/pending',
    requireAuth,
    getPendingPayments
);

router.patch(
    '/payments/:paymentId/settle',
    requireAuth,
    validate(settlePaymentSchema),
    settleOrderPayment
);

router.get(
    '/deliveries/pending',
    requireAuth,
    getPendingDeliveries
);

router.get(
    '/',
    requireAuth,
    getAllOrders
);

router.get(
    '/:id',
    requireAuth,
    getOrderById
);

router.post(
    '/',
    requireAuth,
    validate(createOrderSchema),
    createOrder
);

router.patch(
    '/:id/status',
    requireAuth,
    validate(updateOrderStatusSchema),
    updateOrderStatus
);

router.patch(
    '/:id/delivery/handoff',
    requireAuth,
    validate(deliveryHandoffSchema),
    handoffOrderDelivery
);

export default router;
