import { Router } from 'express';
import {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../controllers/expense.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { createExpenseSchema, updateExpenseSchema } from '../validators/expense.validator';

const router = Router();

router.get('/', requireAuth, checkPermission('expenses.read'), listExpenses);
router.get('/:id', requireAuth, checkPermission('expenses.read'), getExpense);
router.post('/', requireAuth, checkPermission('expenses.create'), validate(createExpenseSchema), createExpense);
router.patch('/:id', requireAuth, checkPermission('expenses.update'), validate(updateExpenseSchema), updateExpense);
router.delete('/:id', requireAuth, checkPermission('expenses.delete'), deleteExpense);

export default router;
