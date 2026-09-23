import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { InventoryCountController } from '../controllers/inventory-count.controller';
import { inventoryCountValidator } from '../validators/inventory-count.validator';

const router = Router();

router.use(requireAuth);

router.post('/', checkPermission('inventory.physical_count'), InventoryCountController.createCount);
router.get('/', checkPermission('inventory.view'), InventoryCountController.getAll);
router.get('/:id', checkPermission('inventory.view'), InventoryCountController.findById);
router.post('/:countId/items', checkPermission('inventory.physical_count'), validate(inventoryCountValidator.addItem), InventoryCountController.addItem);
router.delete('/:countId/items/:ingredientId', checkPermission('inventory.physical_count'), InventoryCountController.removeItem);
router.post('/:countId/complete', checkPermission('inventory.physical_count'), InventoryCountController.completeCount);
router.post('/:countId/apply', checkPermission('inventory.adjust'), InventoryCountController.applyAdjustments);
router.delete('/:id', checkPermission('inventory.physical_count'), InventoryCountController.delete);

export default router;
