import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { InventoryCountController } from '../controllers/inventory-count.controller';

const router = Router();

router.use(requireAuth);

router.post('/', checkPermission('inventory.physical_count'), InventoryCountController.createCount);
router.get('/:id', InventoryCountController.findById);
router.post('/:countId/items', checkPermission('inventory.physical_count'), InventoryCountController.addItem);
router.post('/:countId/complete', checkPermission('inventory.physical_count'), InventoryCountController.completeCount);
router.post('/:countId/apply', checkPermission('inventory.adjust'), InventoryCountController.applyAdjustments);

export default router;
