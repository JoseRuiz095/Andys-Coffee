import { Router } from 'express';
import { ExtraController } from '../controllers/extra.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { createExtraSchema, setActiveSchema, updateExtraSchema } from '../validators/extra.validator';

// Extras are part of the catalog, so they use the products.* permissions. The POS reads the
// extras offered with each product from the public menu (/api/menu).
const router = Router();

router.use(requireAuth);

router.get('/', checkPermission('products.read'), ExtraController.findAll);
router.post('/', checkPermission('products.create'), validate(createExtraSchema), ExtraController.create);
router.patch('/:id', checkPermission('products.update'), validate(updateExtraSchema), ExtraController.update);
router.patch('/:id/active', checkPermission('products.update'), validate(setActiveSchema), ExtraController.setActive);
router.delete('/:id', checkPermission('products.delete'), ExtraController.remove);

export default router;
