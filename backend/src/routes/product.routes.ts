import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { createProductSchema, updateProductSchema, setActiveSchema } from '../validators/product.validator';

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

// Product records include cost, recipes and ingredient stock, so they are not public.
// The POS reads the public menu from /api/menu instead.
router.get('/', requireAuth, checkPermission('products.read'), ProductController.findAll);
router.get('/:id', requireAuth, checkPermission('products.read'), ProductController.findOne);

// Protected routes for administrators with product permissions.
// validate() runs after multer, which is what fills req.body from the multipart form.
router.post(
  '/',
  requireAuth,
  checkPermission('products.create'),
  upload.single('image'),
  validate(createProductSchema),
  ProductController.create
);

router.patch(
  '/:id',
  requireAuth,
  checkPermission('products.update'),
  upload.single('image'),
  validate(updateProductSchema),
  ProductController.update
);

router.patch(
  '/:id/active',
  requireAuth,
  checkPermission('products.update'),
  validate(setActiveSchema),
  ProductController.setActive
);

router.delete(
  '/:id',
  requireAuth,
  checkPermission('products.delete'),
  ProductController.remove
);

export default router;