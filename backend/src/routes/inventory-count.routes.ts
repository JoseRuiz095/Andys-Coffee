import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { InventoryCountController } from '../controllers/inventory-count.controller';

const router = Router();

router.use(requireAuth);

router.post('/', InventoryCountController.createCount);
router.get('/:id', InventoryCountController.findById);
router.post('/:countId/items', InventoryCountController.addItem);
router.post('/:countId/complete', InventoryCountController.completeCount);
router.post('/:countId/apply', InventoryCountController.applyAdjustments);

export default router;
