import express from 'express';
import { InventoryController } from '../controllers/inventory.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { ingredientCreateSchema, ingredientUpdateSchema, inventoryExitSchema } from '../validators/inventory.validator';
import { setActiveSchema } from '../validators/common.validator';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

const canView = checkPermission('inventory.view');

// Search ingredients by name/SKU
router.get('/search', canView, InventoryController.search);

// Get all units (before /summary to avoid path conflicts)
router.get('/units', canView, InventoryController.getUnits);

// Summary endpoints (fast, no pagination)
router.get('/summary', canView, InventoryController.getSummary);
router.get('/value', canView, InventoryController.getTotalValue);
router.get('/low-stock', canView, InventoryController.getLowStock);

// Movements history
router.get('/movements', canView, InventoryController.getMovements);

// Create manual exit
router.post('/exits', checkPermission('inventory.create_exit'), validate(inventoryExitSchema), InventoryController.createExit);

// Create ingredient
router.post('/', checkPermission('inventory.create_ingredient'), validate(ingredientCreateSchema), InventoryController.create);

// Update ingredient
router.patch('/:id', checkPermission('inventory.create_ingredient'), validate(ingredientUpdateSchema), InventoryController.update);

// Activate/deactivate ingredient
router.patch('/:id/active', checkPermission('inventory.create_ingredient'), validate(setActiveSchema), InventoryController.setActive);

// Delete ingredient
router.delete('/:id', checkPermission('inventory.delete_ingredient'), InventoryController.delete);

// List all ingredients
router.get('/', canView, InventoryController.getAll);

// Get by SKU
router.get('/sku/:sku', canView, InventoryController.getBySku);

// Get single ingredient
router.get('/:id', canView, InventoryController.getOne);

export default router;
