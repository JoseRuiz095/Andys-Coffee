import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { checkPermission } from '../middleware/authorization';

const router = Router();

router.get('/', checkPermission('products.read'), ProductController.findAll);
router.get('/:id', checkPermission('products.read'), ProductController.findOne);
router.post('/', checkPermission('products.create'), ProductController.create);
router.patch('/:id', checkPermission('products.update'), ProductController.update);
// router.delete('/:id', checkPermission('products.delete'), ProductController.remove);

export default router;