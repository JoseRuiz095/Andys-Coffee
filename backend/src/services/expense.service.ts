import { Prisma } from '@prisma/client';
import { ExpenseRepository } from '../repositories/expense.repository';
import { CashRepository } from '../repositories/cash.repository';
import { runSerializableWithRetry } from '../repositories/transaction';
import { PreferenceRepository } from '../repositories/preference.repository';
import { CashBusinessRuleError } from './cash.service';
import { ConflictError, NotFoundError } from '../utils/errors';
import { getBusinessMidpointInstant, getTodayInZone, getZonedCalendarDate, getZonedDayBoundaries } from '../utils/businessDate';
import { paginationMeta, paginationOffset } from '../utils/pagination';
import type { CreateExpenseInput, UpdateExpenseInput, ExpenseListQuery } from '../validators/expense.validator';
import { invalidateSnapshotSafely } from './snapshot-invalidation';
import { logger } from '../utils/logger';
import { incomeStatementRepository } from '../repositories/income-statement.repository';

function businessDayRange(startDate?: string, endDate?: string) {
  return {
    gte: startDate ? getZonedDayBoundaries(startDate).start : undefined,
    lt: endDate ? getZonedDayBoundaries(endDate).end : undefined,
  };
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
  return getBusinessMidpointInstant(dateStr, businessHoursOpen, businessHoursClose);
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

  /**
   * R4 (2026-11-14, moved from the controller): payroll and utilities may already be counted as
   * daily fixed expenses, so the user is warned about a possible double count. Best effort.
   */
  async fixedExpenseOverlapWarning(category: string): Promise<string | null> {
    if (!['nomina', 'servicios'].includes(category)) return null;
    try {
      const { total } = await incomeStatementRepository.getFixedExpenseConcepts();
      return total > 0
        ? '⚠️ Aviso: Gastos fijos (nomina/servicios) ya se descuentan automáticamente. Verificar que no esté duplicando.'
        : null;
    } catch (err) {
      logger.warn({ err }, 'No se pudo revisar los gastos fijos para el aviso de duplicado');
      return null;
    }
  },

  async create(input: CreateExpenseInput, createdById: string, idempotencyKey?: string) {
    const expenseDate = input.expenseDate ? await resolveExpenseInstant(input.expenseDate) : undefined;
    try {
      const result = await runSerializableWithRetry(
        async (tx) => {
          const amount = new Prisma.Decimal(input.amount);
          if (idempotencyKey) {
            const existing = await ExpenseRepository.findByIdempotencyKey(createdById, idempotencyKey, tx);
            if (existing) {
              const samePayload = existing.category === input.category
                && existing.description === input.description
                && existing.amount.equals(amount)
                && existing.paymentMethod === input.paymentMethod;
              if (!samePayload) {
                throw new ConflictError('La clave de idempotencia ya fue usada con otros datos.');
              }
              return existing;
            }
          }

        const isCash = input.paymentMethod === 'cash';
        let cashSessionId: string | null = null;
        // N-3 (2026-11-14): cash comes out of a drawer. With no open session the expense used to
        // be saved without touching any drawer, and the next cut showed a false surplus.
        const openSession = isCash ? await CashRepository.findActiveSessionInTransaction(tx) : null;
        if (isCash && !openSession) {
          throw new CashBusinessRuleError('No hay una caja abierta: abre la caja o registra el gasto como transferencia o tarjeta.');
        }
        // EX-2: the cash leaves THIS drawer, so the expense belongs to its business day; another
        // date put the money in one day's cut and the expense in another day's report.
        if (isCash && openSession && input.expenseDate && input.expenseDate !== getZonedCalendarDate(openSession.openedAt)) {
          throw new CashBusinessRuleError(
            `Un gasto en efectivo sale de la caja abierta: su fecha debe ser la de esa caja (${getZonedCalendarDate(openSession.openedAt)}). Para otro día regístralo como transferencia o tarjeta.`,
          );
        }

        // Create the Expense row first with the initial data
        const expense = await ExpenseRepository.create(tx, {
          category: input.category,
          description: input.description,
          amount,
          paymentMethod: input.paymentMethod,
          expenseDate,
          cashSessionId: null, // Will be updated if cash + session exists
          createdById,
          ...(idempotencyKey && { idempotencyKey }),
        });

        // If cash payment, look for open session and record movement
        if (isCash) {
          if (openSession) {
            cashSessionId = openSession.id;

            // The expense is paid from the drawer.
            await CashRepository.recordMovement(tx, {
              cashSessionId: openSession.id,
              type: 'expense',
              amount: amount.negated(),
              referenceType: 'expense',
              referenceId: expense.id,
              description: input.description,
              createdById,
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
        }
      );

      // Invalidate snapshot for the expense date (if it has a final snapshot, it will be recalculated)
      if (result.expenseDate) {
        const dateStr = getZonedCalendarDate(result.expenseDate);
        await invalidateSnapshotSafely(dateStr);
      }

      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        if (idempotencyKey) {
          const existing = await ExpenseRepository.findByIdempotencyKey(createdById, idempotencyKey);
          if (existing) return existing;
        }
      }
      throw error;
    }
  },

  async update(id: string, input: UpdateExpenseInput, updatedById: string) {
    const result = await runSerializableWithRetry(
      async (tx) => {
        const existing = await ExpenseRepository.findByIdInTransaction(tx, id);
        if (!existing) throw new NotFoundError('Gasto no encontrado.');

        // F2: the mandadito expense belongs to its sale (it is reversed or kept when the sale is
        // cancelled); editing it here left the drawer unbalanced after a later cancellation.
        if (existing.sourceOrderId) {
          throw new ConflictError('Este gasto lo generó una venta con mandadito: no se puede editar aquí. Si la venta no ocurrió, cancélala.');
        }

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
          // N-3: same rule as create — becoming a cash expense needs an open drawer. (Old cash
          // expenses saved without a drawer, before this rule, can still be edited as they were.)
          if (!newCashSessionId && existing.paymentMethod !== 'cash') {
            throw new CashBusinessRuleError('No hay una caja abierta: abre la caja o deja el gasto como transferencia o tarjeta.');
          }
        }
        const newImpact = newCashSessionId ? newAmount : new Prisma.Decimal(0);

        if (oldCashSessionId === newCashSessionId) {
          // Same session before/after (both unlinked, or still linked to the same open session).
          const delta = newImpact.sub(oldImpact);
          if (newCashSessionId && !delta.isZero()) {
            // A larger expense takes more cash out of the drawer (and vice versa).
            await CashRepository.recordMovement(tx, {
              cashSessionId: newCashSessionId,
              type: 'expense_adjustment',
              amount: delta.negated(),
              referenceType: 'expense',
              referenceId: id,
              description: `Ajuste de gasto: ${input.description ?? existing.description}`,
              createdById: updatedById,
            });
          }
        } else {
          // Cash-linkage itself is changing (cash<->non-cash, or newly linked to a session).
          if (oldCashSessionId) {
            // The previous cash payment goes back into the drawer.
            await CashRepository.recordMovement(tx, {
              cashSessionId: oldCashSessionId,
              type: 'expense_reversal',
              amount: oldImpact,
              referenceType: 'expense',
              referenceId: id,
              description: `Reversión de gasto: ${existing.description}`,
              createdById: updatedById,
            });
          }
          if (newCashSessionId) {
            await CashRepository.recordMovement(tx, {
              cashSessionId: newCashSessionId,
              type: 'expense',
              amount: newImpact.negated(),
              referenceType: 'expense',
              referenceId: id,
              description: input.description ?? existing.description,
              createdById: updatedById,
            });
          }
        }

        // The edit form always resends the date; only move the stored instant when the
        // calendar day actually changes, so an unrelated edit keeps the original time.
        const previousDateStr = getZonedCalendarDate(existing.expenseDate);
        const dateChanged = input.expenseDate !== undefined && input.expenseDate !== previousDateStr;
        if (dateChanged && newCashSessionId && newCashSessionId !== oldCashSessionId) {
          // Newly cash-linked with another date: same rule as create (EX-2).
          const session = await CashRepository.findActiveSessionInTransaction(tx);
          if (session && input.expenseDate !== getZonedCalendarDate(session.openedAt)) {
            throw new CashBusinessRuleError(
              `Un gasto en efectivo sale de la caja abierta: su fecha debe ser la de esa caja (${getZonedCalendarDate(session.openedAt)}).`,
            );
          }
        }

        const updated = await ExpenseRepository.update(tx, id, {
          ...(input.category !== undefined && { category: input.category }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.amount !== undefined && { amount: newAmount }),
          ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod }),
          ...(dateChanged && { expenseDate: await resolveExpenseInstant(input.expenseDate!) }),
          cashSessionId: newCashSessionId,
        });
        return { updated, previousDateStr };
      }
    );

    // Invalidate snapshots for both the old and the new expense dates
    const affectedDates = new Set([result.previousDateStr, getZonedCalendarDate(result.updated.expenseDate)]);
    for (const dateStr of affectedDates) {
      await invalidateSnapshotSafely(dateStr);
    }

    return result.updated;
  },

  async remove(id: string, deletedById: string) {
    const existing = await runSerializableWithRetry(
      async (tx) => {
        const exp = await ExpenseRepository.findByIdInTransaction(tx, id);
        if (!exp) throw new NotFoundError('Gasto no encontrado.');

        // F2: the mandadito expense belongs to its sale (it is reversed or kept when the sale is
        // cancelled); editing it here left the drawer unbalanced after a later cancellation.
        if (exp.sourceOrderId) {
          throw new ConflictError('Este gasto lo generó una venta con mandadito: no se puede eliminar aquí. Si la venta no ocurrió, cancélala.');
        }

        // Guard: cannot delete if linked to closed session
        if (exp.cashSession && exp.cashSession.status === 'closed') {
          throw new CashBusinessRuleError('No se puede eliminar un gasto asociado a una sesión de caja ya cerrada.');
        }

        // If cash-linked, the money goes back into the drawer (reversal movement).
        if (exp.cashSessionId) {
          await CashRepository.recordMovement(tx, {
            cashSessionId: exp.cashSessionId,
            type: 'expense_reversal',
            amount: exp.amount,
            referenceType: 'expense',
            referenceId: id,
            description: `Reversión de gasto: ${exp.description}`,
            createdById: deletedById,
          });
        }

        // Hard delete (the reversal movement preserves the audit trail)
        await ExpenseRepository.delete(tx, id);

        // Return the expense so we can invalidate its snapshot
        return exp;
      }
    );

    // Invalidate snapshot for the deleted expense date (if it has a final snapshot, it will be recalculated)
    if (existing.expenseDate) {
      const dateStr = getZonedCalendarDate(existing.expenseDate);
      await invalidateSnapshotSafely(dateStr);
    }
  },
};
