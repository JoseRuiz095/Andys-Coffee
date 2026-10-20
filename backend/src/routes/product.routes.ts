import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { createProductSchema, updateProductSchema, setActiveSchema } from '../validators/product.validator';
import { setProductExtrasSchema } from '../validators/extra.validator';
import { ExtraController } from '../controllers/extra.controller';
import { productImageUpload, productImageUploadLimiter } from '../middleware/image-upload.middleware';

const router = Router();

// Product records include cost, recipes and ingredient stock, so they are not public.
// The POS reads the public menu from /api/menu instead.
router.get('/', requireAuth, checkPermission('products.read'), ProductController.findAll);
router.get('/:id', requireAuth, checkPermission('products.read'), ProductController.findOne);

// Protected routes for administrators with product permissions.
router.post(
  '/',
  requireAuth,
  checkPermission('products.create'),
  validate(createProductSchema),
  ProductController.create
);

router.patch(
  '/:id',
  requireAuth,
  checkPermission('products.update'),
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

// Product image: multipart upload (converted to WebP by the service) and removal.
router.patch(
  '/:id/image',
  requireAuth,
  checkPermission('products.update'),
  productImageUploadLimiter,
  productImageUpload,
  ProductController.uploadImage
);

router.delete(
  '/:id/image',
  requireAuth,
  checkPermission('products.update'),
  ProductController.removeImage
);

// Which extras the POS offers with this product.
router.patch(
  '/:id/extras',
  requireAuth,
  checkPermission('products.update'),
  validate(setProductExtrasSchema),
  ExtraController.setProductExtras
);

router.delete(
  '/:id',
  requireAuth,
  checkPermission('products.delete'),
  ProductController.remove
);

export default router;
