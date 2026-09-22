import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ExpenseRepository } from '../repositories/expense.repository';
import { incomeStatementRepository } from '../repositories/income-statement.repository';
import { CashRepository } from '../repositories/cash.repository';
import { PreferenceRepository } from '../repositories/preference.repository';
import { CashBusinessRuleError } from './cash.service';
import { NotFoundError } from '../utils/errors';
import { getTodayInZone, getZonedCalendarDate, getZonedDayBoundaries, getZonedInstant } from '../utils/businessDate';
import { paginationMeta, paginationOffset } from '../utils/pagination';
import type { CreateExpenseInput, UpdateExpenseInput, ExpenseListQuery } from '../validators/expense.validator';

function businessDayRange(startDate?: string, endDate?: string) {
  return {
    gte: startDate ? getZonedDayBoundaries(startDate).start : undefined,
    lt: endDate ? getZonedDayBoundaries(endDate).end : undefined,
  };
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + (minute || 0);
}

/**
 * Instant stored for an expense dated `dateStr` (YYYY-MM-DD, business calendar).
 * The income statement only counts expenses inside business hours, so a back-dated
 * expense is placed at the middle of the configured business day (in CASH_TIMEZONE)
 * instead of a fixed UTC time that can fall before opening. Today's date keeps "now".
 */
async function resolveExpenseInstant(dateStr: string): Promise<Date> {
  if (dateStr === getTodayInZone()) return new Date();
  const { businessHoursOpen, businessHoursClose } = await PreferenceRepository.getGeneralPreferences();
  const open = toMinutes(businessHoursOpen);
  const close = toMinutes(businessHoursClose);
  const midpoint = close > open ? Math.floor((open + close) / 2) : 12 * 60;
  return getZonedInstant(dateStr, midpoint);
}

export const ExpenseService = {
  async findAll(query: ExpenseListQuery) {
    const { page, limit } = query;
    const skip = paginationOffset(page, limit);
    const range = businessDayRange(query.startDate, query.endDate);

    const where: Prisma.ExpenseWhereInput = {
      ...(query.category && { category: query.category }),
      ...(query.createdById && { createdById: query.createdById }),
      ...(query.cashSessionId && { cashSessionId: query.cashSessionId }),
      ...((range.gte || range.lt) && {
        expenseDate: {
          ...(range.gte && { gte: range.gte }),
          ...(range.lt && { lt: range.lt }),
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
    const expenseDate = input.expenseDate ? await resolveExpenseInstant(input.expenseDate) : undefined;
    const result = await prisma.$transaction(
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
          expenseDate,
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

    // Invalidate snapshot for the expense date (if it has a final snapshot, it will be recalculated)
    if (result.expenseDate) {
      const dateStr = getZonedCalendarDate(result.expenseDate);
      await incomeStatementRepository.invalidateSnapshot(dateStr);
    }

    return result;
  },

  async update(id: string, input: UpdateExpenseInput, updatedById: string) {
    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await ExpenseRepository.findByIdInTransaction(tx, id);
        if (!existing) throw new NotFoundError('Gasto no encontrado.');

        // Guard: cannot edit if linked to closed session
        if (existing.cashSession && existing.cashSession.status === 'closed') {
          throw new CashBusinessRuleError('No se puede editar un gasto asociado a una sesión de caja ya cerrada.');
        }

        const newAmount = input.amount !== undefined ? new Prisma.Decimal(input.amount) : existing.amount;
        const newPaymentMethod = input.paymentMethod ?? existing.paymentMethod;

        const oldCashSessionId = existing.cashSessionId;
        const oldImpact = oldCashSessionId ? existing.amount : new Prisma.Decimal(0);

        // Only stays/becomes cash-linked if the (possibly new) payment method is 'cash'.
        // Re-links to whatever session it was already tied to, or to the currently open
        // session if it's newly becoming a cash expense; otherwise stays unlinked, matching
        // create()'s behavior of never retroactively adopting a later-opened session.
        let newCashSessionId: string | null = null;
        if (newPaymentMethod === 'cash') {
          newCashSessionId = oldCashSessionId ?? (await CashRepository.findActiveSessionInTransaction(tx))?.id ?? null;
        }
        const newImpact = newCashSessionId ? newAmount : new Prisma.Decimal(0);

        if (oldCashSessionId === newCashSessionId) {
          // Same session before/after (both unlinked, or still linked to the same open session).
          const delta = newImpact.sub(oldImpact);
          if (newCashSessionId && !delta.isZero()) {
            await tx.cashMovement.create({
              data: {
                cashSessionId: newCashSessionId,
                type: 'expense_adjustment',
                amount: delta.negated(),
                referenceType: 'expense',
                referenceId: id,
                description: `Ajuste de gasto: ${input.description ?? existing.description}`,
                createdById: updatedById,
              },
            });

            await tx.cashSession.update({
              where: { id: newCashSessionId },
              data: { expectedAmount: { decrement: delta } },
            });
          }
        } else {
          // Cash-linkage itself is changing (cash<->non-cash, or newly linked to a session).
          if (oldCashSessionId) {
            await tx.cashMovement.create({
              data: {
                cashSessionId: oldCashSessionId,
                type: 'expense_reversal',
                amount: oldImpact.negated(),
                referenceType: 'expense',
                referenceId: id,
                description: `Reversión de gasto: ${existing.description}`,
                createdById: updatedById,
              },
            });
            await tx.cashSession.update({
              where: { id: oldCashSessionId },
              data: { expectedAmount: { increment: oldImpact } },
            });
          }
          if (newCashSessionId) {
            await tx.cashMovement.create({
              data: {
                cashSessionId: newCashSessionId,
                type: 'expense',
                amount: newImpact,
                referenceType: 'expense',
                referenceId: id,
                description: input.description ?? existing.description,
                createdById: updatedById,
              },
            });
            await tx.cashSession.update({
              where: { id: newCashSessionId },
              data: { expectedAmount: { decrement: newImpact } },
            });
          }
        }

        // The edit form always resends the date; only move the stored instant when the
        // calendar day actually changes, so an unrelated edit keeps the original time.
        const previousDateStr = getZonedCalendarDate(existing.expenseDate);
        const dateChanged = input.expenseDate !== undefined && input.expenseDate !== previousDateStr;

        const updated = await ExpenseRepository.update(tx, id, {
          ...(input.category !== undefined && { category: input.category }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.amount !== undefined && { amount: newAmount }),
          ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod }),
          ...(dateChanged && { expenseDate: await resolveExpenseInstant(input.expenseDate!) }),
          cashSessionId: newCashSessionId,
        });
        return { updated, previousDateStr };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    // Invalidate snapshots for both the old and the new expense dates
    const affectedDates = new Set([result.previousDateStr, getZonedCalendarDate(result.updated.expenseDate)]);
    for (const dateStr of affectedDates) {
      await incomeStatementRepository.invalidateSnapshot(dateStr);
    }

    return result.updated;
  },

  async remove(id: string, deletedById: string) {
    const existing = await prisma.$transaction(
      async (tx) => {
        const exp = await ExpenseRepository.findByIdInTransaction(tx, id);
        if (!exp) throw new NotFoundError('Gasto no encontrado.');

        // Guard: cannot delete if linked to closed session
        if (exp.cashSession && exp.cashSession.status === 'closed') {
          throw new CashBusinessRuleError('No se puede eliminar un gasto asociado a una sesión de caja ya cerrada.');
        }

        // If cash-linked, create a reversal movement
        if (exp.cashSessionId) {
          await tx.cashMovement.create({
            data: {
              cashSessionId: exp.cashSessionId,
              type: 'expense_reversal',
              amount: exp.amount.negated(),
              referenceType: 'expense',
              referenceId: id,
              description: `Reversión de gasto: ${exp.description}`,
              createdById: deletedById,
            },
          });

          await tx.cashSession.update({
            where: { id: exp.cashSessionId },
            data: { expectedAmount: { increment: exp.amount } },
          });
        }

        // Hard delete (the reversal movement preserves the audit trail)
        await ExpenseRepository.delete(tx, id);

        // Return the expense so we can invalidate its snapshot
        return exp;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    // Invalidate snapshot for the deleted expense date (if it has a final snapshot, it will be recalculated)
    if (existing.expenseDate) {
      const dateStr = getZonedCalendarDate(existing.expenseDate);
      await incomeStatementRepository.invalidateSnapshot(dateStr);
    }
  },
};
