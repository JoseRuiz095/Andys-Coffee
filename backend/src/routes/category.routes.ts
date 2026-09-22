import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';

const router = Router();

// Public routes
router.get('/', CategoryController.getAll);
router.get('/:id', CategoryController.getById);

// Admin routes
router.post(
  '/',
  requireAuth,
  checkPermission('categories.create'),
  CategoryController.create
);

router.patch(
  '/:id',
  requireAuth,
  checkPermission('categories.update'),
  CategoryController.update
);

router.patch(
  '/:id/active',
  requireAuth,
  checkPermission('categories.update'),
  CategoryController.setActive
);

export default router;
