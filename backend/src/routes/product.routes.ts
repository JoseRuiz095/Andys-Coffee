import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';

const router = Router();

class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 20,
    fieldSize: 64 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new UploadValidationError('Solo se permiten imágenes JPEG, PNG o WebP.'));
      return;
    }
    callback(null, true);
  },
});

// Public routes for anyone to see products
router.get('/', ProductController.findAll);
router.get('/:id', ProductController.findOne);

// Protected routes for administrators with product permissions
router.post(
  '/',
  requireAuth,
  checkPermission('products.create'),
  upload.single('image'),
  ProductController.create
);

router.patch(
  '/:id',
  requireAuth,
  checkPermission('products.update'),
  upload.single('image'),
  ProductController.update
);

router.patch(
  '/:id/active',
  requireAuth,
  checkPermission('products.update'),
  ProductController.setActive
);

router.delete(
  '/:id',
  requireAuth,
  checkPermission('products.delete'),
  ProductController.remove
);

export default router;