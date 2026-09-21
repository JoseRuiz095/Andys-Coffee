import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ExpenseService } from '../services/expense.service';
import { incomeStatementRepository } from '../repositories/income-statement.repository';
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseListQuerySchema,
} from '../validators/expense.validator';
import { auditLog } from '../utils/logger';

function getAuthenticatedUserId(req: Request) {
  if (!req.user?.id) {
    throw new Error('Authentication required.');
  }
  return req.user.id;
}

export const listExpenses = asyncHandler(async (req: Request, res: Response) => {
  const query = expenseListQuerySchema.parse(req.query);
  const result = await ExpenseService.findAll(query);
  res.status(200).json(result);
});

export const getExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await ExpenseService.findOne(String(req.params.id));
  res.status(200).json({ expense });
});

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  const input = await createExpenseSchema.parseAsync(req.body);
  const userId = getAuthenticatedUserId(req);
  const expense = await ExpenseService.create(input, userId);

  // Check if category matches nomina/servicios and fixed expenses are configured
  let warning: string | null = null;
  if (['nomina', 'servicios'].includes(input.category)) {
    try {
      const fixedExpenses = await incomeStatementRepository.getFixedExpenseConcepts();
      if (fixedExpenses && Object.values(fixedExpenses).some((val) => val > 0)) {
        warning = '⚠️ Aviso: Gastos fijos (nomina/servicios) ya se descuentan automáticamente. Verificar que no esté duplicando.';
      }
    } catch {
      // Silently ignore error in warning check
    }
  }

  auditLog(
    {
      requestId: req.id,
      actor: { id: userId, name: req.user?.name, role: req.user?.roleName },
      action: 'EXPENSE_CREATED',
      entity: 'expense',
      entityId: expense.id,
      amount: expense.amount.toFixed(2),
    },
    'Expense created'
  );
  res.status(201).json({ expense, warning });
});

export const updateExpense = asyncHandler(async (req: Request, res: Response) => {
  const input = updateExpenseSchema.parse(req.body);
  const userId = getAuthenticatedUserId(req);
  const expense = await ExpenseService.update(String(req.params.id), input, userId);
  auditLog(
    {
      requestId: req.id,
      actor: { id: userId, name: req.user?.name, role: req.user?.roleName },
      action: 'EXPENSE_UPDATED',
      entity: 'expense',
      entityId: expense.id,
    },
    'Expense updated'
  );
  res.status(200).json({ expense });
});

export const deleteExpense = asyncHandler(async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  await ExpenseService.remove(String(req.params.id), userId);
  auditLog(
    {
      requestId: req.id,
      actor: { id: userId, name: req.user?.name, role: req.user?.roleName },
      action: 'EXPENSE_DELETED',
      entity: 'expense',
      entityId: String(req.params.id),
    },
    'Expense deleted'
  );
  res.status(204).send();
});
