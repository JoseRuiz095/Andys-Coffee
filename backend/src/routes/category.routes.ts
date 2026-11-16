import { Router, type RequestHandler } from 'express';
import { CategoryController } from '../controllers/category.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { createCategorySchema, updateCategorySchema, setActiveSchema } from '../validators/category.validator';

const router = Router();

/**
 * R3 (2026-11-14): the menu needs the active categories without a session; inactive ones
 * (?includeInactive=true, used by the category manager) are only for categories.update.
 */
const inactiveNeedsPermission: RequestHandler = (req, res, next) => {
  if (req.query.includeInactive !== 'true') return next();
  return requireAuth(req, res, (error?: unknown) => {
    if (error) return next(error);
    return checkPermission('categories.update')(req, res, next);
  });
};

// Public routes
router.get('/', inactiveNeedsPermission, CategoryController.getAll);
router.get('/:id', CategoryController.getById);

// Admin routes
router.post('/', requireAuth, checkPermission('categories.create'), validate(createCategorySchema), CategoryController.create);
router.patch('/:id', requireAuth, checkPermission('categories.update'), validate(updateCategorySchema), CategoryController.update);
router.patch('/:id/active', requireAuth, checkPermission('categories.update'), validate(setActiveSchema), CategoryController.setActive);
router.delete('/:id', requireAuth, checkPermission('categories.delete'), CategoryController.delete);

export default router;
