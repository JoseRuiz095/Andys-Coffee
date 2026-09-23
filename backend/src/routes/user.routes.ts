import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { userCreateSchema, userUpdateSchema, setActiveSchema } from '../validators/user.validator';

const router = Router();

// All user routes require authentication
router.use(requireAuth);

// Get all users (paginated, with filtering)
router.get('/', checkPermission('users.read'), UserController.getAll);

// Get single user by ID
router.get('/:id', checkPermission('users.read'), UserController.getOne);

// Create new user (the service also blocks assigning a role with permissions the actor lacks)
router.post('/', checkPermission('users.create'), validate(userCreateSchema), UserController.create);

// Update user
router.patch('/:id', checkPermission('users.update'), validate(userUpdateSchema), UserController.update);

// Activate/deactivate user
router.patch('/:id/active', checkPermission('users.update'), validate(setActiveSchema), UserController.setActive);

// Delete user
router.delete('/:id', checkPermission('users.delete'), UserController.delete);

export default router;
