import express from 'express';
import { PurchaseController } from '../controllers/purchase.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Get all purchases with optional status filter
router.get('/', PurchaseController.getAll);

// Create new purchase
router.post(
  '/',
  checkPermission('inventory.create_entry'),
  PurchaseController.create
);

// Get single purchase
router.get('/:id', PurchaseController.getOne);

// Receive purchase (update status and inventory)
router.post(
  '/:id/receive',
  checkPermission('inventory.create_entry'),
  PurchaseController.receivePurchase
);

// Delete a draft purchase (cancel before it's received)
router.delete(
  '/:id',
  checkPermission('inventory.create_entry'),
  PurchaseController.delete
);

export default router;
