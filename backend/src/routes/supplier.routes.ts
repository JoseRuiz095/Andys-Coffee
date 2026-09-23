import { Router } from 'express';
import { SupplierController } from '../controllers/supplier.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { supplierCreateSchema, supplierUpdateSchema } from '../validators/supplier.validator';
import { setActiveSchema } from '../validators/common.validator';

const router = Router();

// All supplier routes require authentication
router.use(requireAuth);

const canView = checkPermission('inventory.view');
const canManage = checkPermission('inventory.manage_suppliers');

// Search suppliers by name or other fields
router.get('/search', canView, SupplierController.search);

// Create new supplier
router.post('/', canManage, validate(supplierCreateSchema), SupplierController.create);

// Get all suppliers (paginated)
router.get('/', canView, SupplierController.getAll);

// Get single supplier by ID
router.get('/:id', canView, SupplierController.getOne);

// Update supplier
router.patch('/:id', canManage, validate(supplierUpdateSchema), SupplierController.update);

// Activate/deactivate supplier
router.patch('/:id/active', canManage, validate(setActiveSchema), SupplierController.setActive);

// Delete supplier
router.delete('/:id', checkPermission('inventory.delete_supplier'), SupplierController.delete);

export default router;
