import express from 'express';
import { PurchaseController } from '../controllers/purchase.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { createPurchaseSchema } from '../validators/purchase.validator';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Get all purchases with optional status filter
router.get('/', checkPermission('inventory.view'), PurchaseController.getAll);

// Create new purchase
router.post('/', checkPermission('inventory.create_entry'), validate(createPurchaseSchema), PurchaseController.create);

// Get single purchase
router.get('/:id', checkPermission('inventory.view'), PurchaseController.getOne);

// Receive purchase (update status and inventory)
router.post('/:id/receive', checkPermission('inventory.create_entry'), PurchaseController.receivePurchase);

// Delete a draft purchase (cancel before it is received)
router.delete('/:id', checkPermission('inventory.create_entry'), PurchaseController.delete);

export default router;
