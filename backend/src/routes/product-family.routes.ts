import { Router } from 'express';
import { ProductFamilyController } from '../controllers/product-family.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { createProductFamilySchema, updateProductFamilySchema } from '../validators/product-family.validator';

// Families are part of the catalog, so they use the products.* permissions. The POS reads
// each product's family from the public menu (/api/menu).
const router = Router();

router.use(requireAuth);

router.get('/', checkPermission('products.read'), ProductFamilyController.findAll);
router.post('/', checkPermission('products.create'), validate(createProductFamilySchema), ProductFamilyController.create);
router.patch('/:id', checkPermission('products.update'), validate(updateProductFamilySchema), ProductFamilyController.update);

export default router;
