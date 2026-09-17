import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ExpenseRepository } from '../repositories/expense.repository';
import { CashRepository } from '../repositories/cash.repository';
import { CashBusinessRuleError } from './cash.service';
import { NotFoundError } from '../utils/errors';
import { paginationMeta, paginationOffset } from '../utils/pagination';
import type { CreateExpenseInput, UpdateExpenseInput, ExpenseListQuery } from '../validators/expense.validator';

function dayRangeUtc(startDate?: string, endDate?: string) {
  return {
    gte: startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined,
    lte: endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined,
  };
}

export const ExpenseService = {
  async findAll(query: ExpenseListQuery) {
    const { page, limit } = query;
    const skip = paginationOffset(page, limit);
    const range = dayRangeUtc(query.startDate, query.endDate);

    const where: Prisma.ExpenseWhereInput = {
      ...(query.category && { category: query.category }),
      ...(query.createdById && { createdById: query.createdById }),
      ...(query.cashSessionId && { cashSessionId: query.cashSessionId }),
      ...((range.gte || range.lte) && {
        expenseDate: {
          ...(range.gte && { gte: range.gte }),
          ...(range.lte && { lte: range.lte }),
        },
      }),
    };

    const { expenses, total } = await ExpenseRepository.findWithPagination(where, skip, limit);
    return { data: expenses, pagination: paginationMeta(page, limit, total) };
  },

  async findOne(id: string) {
    const expense = await ExpenseRepository.findById(id);
    if (!expense) throw new NotFoundError('Gasto no encontrado.');
    return expense;
  },

  async create(input: CreateExpenseInput, createdById: string) {
    return prisma.$transaction(
      async (tx) => {
        const amount = new Prisma.Decimal(input.amount);
        const isCash = input.paymentMethod === 'cash';
        let cashSessionId: string | null = null;

        // Create the Expense row first with the initial data
        const expense = await ExpenseRepository.create(tx, {
          category: input.category,
          description: input.description,
          amount,
          paymentMethod: input.paymentMethod,
          expenseDate: input.expenseDate ? new Date(`${input.expenseDate}T12:00:00.000Z`) : undefined,
          cashSessionId: null, // Will be updated if cash + session exists
          createdById,
        });

        // If cash payment, look for open session and record movement
        if (isCash) {
          const openSession = await CashRepository.findActiveSessionInTransaction(tx);
          if (openSession) {
            cashSessionId = openSession.id;

            // Create the cash movement with referenceId set directly
            await tx.cashMovement.create({
              data: {
                cashSessionId: openSession.id,
                type: 'expense',
                amount,
                referenceType: 'expense',
                referenceId: expense.id,
                description: input.description,
                createdById,
              },
            });

            // Decrement expected amount
            await tx.cashSession.update({
              where: { id: openSession.id },
              data: { expectedAmount: { decrement: amount } },
            });

            // Update the expense with the cash session id
            await ExpenseRepository.update(tx, expense.id, { cashSessionId });
          }
        }

        // Return the expense with updated data
        return {
          ...expense,
          cashSessionId,
          cashSession: cashSessionId ? { id: cashSessionId, status: 'open' } : null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  },

  async update(id: string, input: UpdateExpenseInput, updatedById: string) {
    return prisma.$transaction(
      async (tx) => {
        const existing = await ExpenseRepository.findByIdInTransaction(tx, id);
        if (!existing) throw new NotFoundError('Gasto no encontrado.');

        // Guard: cannot edit if linked to closed session
        if (existing.cashSession && existing.cashSession.status === 'closed') {
          throw new CashBusinessRuleError('No se puede editar un gasto asociado a una sesión de caja ya cerrada.');
        }

        const newAmount = input.amount !== undefined ? new Prisma.Decimal(input.amount) : existing.amount;
        const amountDelta = newAmount.sub(existing.amount);

        // If cash-linked and amount changed, adjust expected amount
        if (existing.cashSessionId && !amountDelta.isZero()) {
          await tx.cashMovement.create({
            data: {
              cashSessionId: existing.cashSessionId,
              type: 'expense_adjustment',
              amount: amountDelta.negated(),
              referenceType: 'expense',
              referenceId: id,
              description: `Ajuste de gasto: ${input.description ?? existing.description}`,
              createdById: updatedById,
            },
          });

          await tx.cashSession.update({
            where: { id: existing.cashSessionId },
            data: { expectedAmount: { decrement: amountDelta } },
          });
        }

        return ExpenseRepository.update(tx, id, {
          ...(input.category !== undefined && { category: input.category }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.amount !== undefined && { amount: newAmount }),
          ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod }),
          ...(input.expenseDate !== undefined && { expenseDate: new Date(`${input.expenseDate}T12:00:00.000Z`) }),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  },

  async remove(id: string, deletedById: string) {
    return prisma.$transaction(
      async (tx) => {
        const existing = await ExpenseRepository.findByIdInTransaction(tx, id);
        if (!existing) throw new NotFoundError('Gasto no encontrado.');

        // Guard: cannot delete if linked to closed session
        if (existing.cashSession && existing.cashSession.status === 'closed') {
          throw new CashBusinessRuleError('No se puede eliminar un gasto asociado a una sesión de caja ya cerrada.');
        }

        // If cash-linked, create a reversal movement
        if (existing.cashSessionId) {
          await tx.cashMovement.create({
            data: {
              cashSessionId: existing.cashSessionId,
              type: 'expense_reversal',
              amount: existing.amount.negated(),
              referenceType: 'expense',
              referenceId: id,
              description: `Reversión de gasto: ${existing.description}`,
              createdById: deletedById,
            },
          });

          await tx.cashSession.update({
            where: { id: existing.cashSessionId },
            data: { expectedAmount: { increment: existing.amount } },
          });
        }

        // Hard delete (the reversal movement preserves the audit trail)
        await ExpenseRepository.delete(tx, id);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  },
};
