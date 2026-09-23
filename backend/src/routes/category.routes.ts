import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { createCategorySchema, updateCategorySchema, setActiveSchema } from '../validators/category.validator';

const router = Router();

// Public routes
router.get('/', CategoryController.getAll);
router.get('/:id', CategoryController.getById);

// Admin routes
router.post('/', requireAuth, checkPermission('categories.create'), validate(createCategorySchema), CategoryController.create);
router.patch('/:id', requireAuth, checkPermission('categories.update'), validate(updateCategorySchema), CategoryController.update);
router.patch('/:id/active', requireAuth, checkPermission('categories.update'), validate(setActiveSchema), CategoryController.setActive);

export default router;
