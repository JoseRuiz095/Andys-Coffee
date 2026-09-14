import { Router } from 'express';
import { SupplierController } from '../controllers/supplier.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// All supplier routes require authentication
router.use(requireAuth);

// Search suppliers by name or other fields
router.get('/search', SupplierController.search);

// Create new supplier
router.post('/', SupplierController.create);

// Get all suppliers (paginated)
router.get('/', SupplierController.getAll);

// Get single supplier by ID
router.get('/:id', SupplierController.getOne);

export default router;
