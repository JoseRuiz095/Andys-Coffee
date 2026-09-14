import express from 'express';
import { PurchaseController } from '../controllers/purchase.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Get all purchases with optional status filter
router.get('/', PurchaseController.getAll);

// Create new purchase
router.post('/', PurchaseController.create);

// Get single purchase
router.get('/:id', PurchaseController.getOne);

// Receive purchase (update status and inventory)
router.post('/:id/receive', PurchaseController.receivePurchase);

export default router;
