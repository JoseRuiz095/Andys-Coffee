import { Router } from 'express';
import { RoleController } from '../controllers/role.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';

const router = Router();

// All role routes require authentication
router.use(requireAuth);

// Get all roles
router.get('/', checkPermission('users.read'), RoleController.getAll);

// Get single role by ID
router.get('/:id', checkPermission('users.read'), RoleController.getOne);

// Create new role
router.post('/', checkPermission('users.create'), RoleController.create);

// Update role
router.patch('/:id', checkPermission('users.update'), RoleController.update);

// Assign permissions to role
router.patch('/:id/permissions', checkPermission('users.update'), RoleController.assignPermissions);

// Delete role
router.delete('/:id', checkPermission('users.delete'), RoleController.delete);

export default router;
