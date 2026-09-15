import { Router } from 'express';
import { SupplierController } from '../controllers/supplier.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';

const router = Router();

// All supplier routes require authentication
router.use(requireAuth);

// Search suppliers by name or other fields
router.get('/search', SupplierController.search);

// Create new supplier
router.post('/', checkPermission('inventory.manage_suppliers'), SupplierController.create);

// Get all suppliers (paginated)
router.get('/', SupplierController.getAll);

// Get single supplier by ID
router.get('/:id', SupplierController.getOne);

// Update supplier
router.patch('/:id', checkPermission('inventory.manage_suppliers'), SupplierController.update);

// Activate/deactivate supplier
router.patch('/:id/active', checkPermission('inventory.manage_suppliers'), SupplierController.setActive);

// Delete supplier
router.delete('/:id', checkPermission('inventory.delete_supplier'), SupplierController.delete);

export default router;
