import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';

const router = Router();

// Configuramos multer para que guarde los archivos en memoria como un buffer.
const upload = multer({ storage: multer.memoryStorage() });

// Public routes for anyone to see products
router.get('/', ProductController.findAll);
router.get('/:id', ProductController.findOne);

// Protected routes for administrators with 'manage:products' permission
router.post(
  '/',
  requireAuth,
  checkPermission('manage:products'),
  upload.single('image'),
  ProductController.create
);

router.patch(
  '/:id',
  requireAuth,
  checkPermission('manage:products'),
  upload.single('image'),
  ProductController.update
);

router.delete(
  '/:id',
  requireAuth,
  checkPermission('manage:products'),
  ProductController.remove
);

export default router;