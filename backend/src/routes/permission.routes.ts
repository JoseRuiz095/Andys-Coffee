import { Router } from 'express';
import { PermissionController } from '../controllers/role.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';

const router = Router();

// All permission routes require authentication
router.use(requireAuth);

// List all permissions
router.get('/', checkPermission('users.read'), PermissionController.list);

export default router;
