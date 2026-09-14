import express from 'express';
import { InventoryController } from '../controllers/inventory.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Search ingredients by name/SKU
router.get('/search', InventoryController.search);

// Summary endpoints (fast, no pagination)
router.get('/summary', InventoryController.getSummary);
router.get('/value', InventoryController.getTotalValue);
router.get('/low-stock', InventoryController.getLowStock);

// Movements history
router.get('/movements', InventoryController.getMovements);

// Create manual exit
router.post('/exits', InventoryController.createExit);

// Create ingredient
router.post(
  '/',
  checkPermission('inventory.create_ingredient'),
  InventoryController.create
);

// Update ingredient
router.patch(
  '/:id',
  checkPermission('inventory.create_ingredient'),
  InventoryController.update
);

// Activate/deactivate ingredient
router.patch(
  '/:id/active',
  checkPermission('inventory.create_ingredient'),
  InventoryController.setActive
);

// List all ingredients
router.get('/', InventoryController.getAll);

// Get by SKU
router.get('/sku/:sku', InventoryController.getBySku);

// Get single ingredient
router.get('/:id', InventoryController.getOne);

export default router;
