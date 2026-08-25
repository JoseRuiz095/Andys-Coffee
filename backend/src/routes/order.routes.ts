import { Router } from 'express';
import { createOrder } from '../controllers/order.controller';
import { validate } from '../middleware/validate';
import { createOrderSchema } from '../validators/order.validator';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/', requireAuth, validate(createOrderSchema), createOrder);

export default router;
