import { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { CASH_TIMEZONE } from '../config/app';
import { CashRepository, type CashSessionWithDetails } from '../repositories/cash.repository';
import { incomeStatementRepository } from '../repositories/income-statement.repository';
import { PreferenceRepository } from '../repositories/preference.repository';
import { UserRepository } from '../repositories/user.repository';
import type { CloseCashSessionInput, CorrectCashClosingInput, OpenCashSessionInput, CashSessionHistoryQuery } from '../validators/cash.validator';
import { paginationMeta } from '../utils/pagination';
import { getZonedCalendarDate } from '../utils/businessDate';
import { NotificationService } from './notification.service';

export class CashBusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}

export const CashService = {
  async getActiveSession(): Promise<CashSessionWithDetails | null> {
    return CashRepository.findActiveSession();
  },

  async getSessionsHistory(query: CashSessionHistoryQuery) {
    const { page, limit } = query;
    const { sessions, total } = await CashRepository.findSessionsHistory(query, page, limit);
    return { data: sessions, pagination: paginationMeta(page, limit, total) };
  },

  async closeSession(closedById: string, input: CloseCashSessionInput): Promise<CashSessionWithDetails | null> {
    const closedSession = await prismaTransaction(async (tx) => {
      const session = await CashRepository.findActiveSessionInTransaction(tx);
      if (!session) return null;

      const closingAmount = new Prisma.Decimal(input.closingAmount);
      const difference = closingAmount.sub(session.expectedAmount);
      if (!difference.isZero() && !input.reason) {
        throw new CashBusinessRuleError('Debes indicar un motivo cuando existe una diferencia.');
      }

      return CashRepository.closeActiveSession(
        tx,
        session,
        closedById,
        closingAmount,
        input.reason ?? 'Cierre de caja sin diferencia',
        input.comment,
      );
    });

    // Dispatched after the transaction commits so an unrelated notification write
    // can't contribute to a serialization conflict on the cash-closing transaction.
    if (closedSession) {
      const generalPrefs = await PreferenceRepository.getGeneralPreferences();
      const symbol = generalPrefs.currencySymbol;
      const differenceLabel = closedSession.difference?.isNegative()
        ? `-${symbol}${closedSession.difference.abs().toFixed(2)}`
        : `${symbol}${closedSession.difference?.toFixed(2) ?? '0.00'}`;
      await createCashNotification({
        title: 'Cierre de caja confirmado',
        message: `La caja ${closedSession.cashRegister.name} fue cerrada. Efectivo contado: ${symbol}${closedSession.closingAmount?.toFixed(2) ?? '0.00'}. Diferencia: ${differenceLabel}.`,
        referenceId: closedSession.id,
      });
    }

    return closedSession;
  },

  async correctClosing(correctedById: string, sessionId: string, input: CorrectCashClosingInput): Promise<CashSessionWithDetails> {
    const correctedSession = await prismaTransaction(async (tx) => (
      CashRepository.correctClosedSession(
        tx,
        sessionId,
        correctedById,
        new Prisma.Decimal(input.correctedAmount),
        input.reason,
        input.comment,
      )
    ));

    if (!correctedSession) {
      throw new CashBusinessRuleError('Solo se puede corregir una sesión cerrada con un conteo registrado.');
    }

    // Invalidate any final snapshot for the day of this corrected session
    // so it recalculates with the corrected cash movement
    const dateStr = getZonedCalendarDate(correctedSession.openedAt);
    await incomeStatementRepository.invalidateSnapshot(dateStr);

    return correctedSession;
  },

  async closeIfBusinessDayEnded(closedById: string, now: Date = new Date()): Promise<CashSessionWithDetails | null> {
    const currentHour = Number(new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: CASH_TIMEZONE,
    }).format(now));

    // Get configured closing hour, fallback to 22:00 if not set (from SystemPreference)
    const generalPrefs = await PreferenceRepository.getGeneralPreferences();
    const [closeHour] = generalPrefs.businessHoursClose.split(':').map(Number);

    if (currentHour < closeHour) return null;
    const session = await CashRepository.findActiveSession();
    if (!session) return null;
    return this.closeSession(closedById, {
      closingAmount: Number(session.expectedAmount),
      reason: 'Cierre automático al finalizar la jornada',
      comment: 'Cierre automático con el efectivo esperado registrado.',
    });
  },

  async openSession(input: OpenCashSessionInput, openedById: string): Promise<CashSessionWithDetails> {
    try {
      const session = await prismaTransaction(async (tx) => {
        const register = await CashRepository.findActiveRegister(tx, input.cashRegisterId);
        if (!register) {
          throw new CashBusinessRuleError('No hay una caja activa disponible.');
        }

        const activeSession = await CashRepository.findActiveSessionForRegister(tx, register.id);
        if (activeSession) {
          throw new CashBusinessRuleError('Ya existe una sesión abierta para esta caja.');
        }

        return CashRepository.createSessionWithOpening(tx, {
          cashRegisterId: register.id,
          openedById,
          openingAmount: new Prisma.Decimal(input.openingAmount),
        });
      });

      // Dispatched after the transaction commits, same reasoning as closeSession.
      await createCashNotification({
        title: 'Apertura de caja confirmada',
        message: `La caja ${session.cashRegister.name} fue abierta por ${session.openedBy.name}. Fondo inicial: $${session.openingAmount.toFixed(2)}.`,
        referenceId: session.id,
      });

      return session;
    } catch (error) {
      if (error instanceof CashBusinessRuleError) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new CashBusinessRuleError('Ya existe una sesión abierta para esta caja.');
      }

      throw error;
    }
  },

  async reopenSession(sessionId: string, reopenedById: string, reason: string): Promise<CashSessionWithDetails> {
    const reopenedSession = await prismaTransaction(async (tx) => {
      const session = await tx.cashSession.findUnique({
        where: { id: sessionId },
        include: { cashRegister: true, closedBy: true, openedBy: true },
      });

      if (!session) {
        throw new CashBusinessRuleError('Sesión de caja no encontrada.');
      }

      if (session.status === 'open') {
        throw new CashBusinessRuleError('Esta sesión ya está abierta.');
      }

      // The closing fields are wiped below, so keep the discarded cash count in the audit trail.
      await tx.auditLog.create({
        data: {
          userId: reopenedById,
          action: 'CASH_SESSION_REOPENED',
          cashSessionId: session.id,
          metadata: {
            previousClosingAmount: session.closingAmount?.toString() ?? null,
            previousExpectedAmount: session.expectedAmount.toString(),
            previousDifference: session.difference?.toString() ?? null,
            previousClosedAt: session.closedAt?.toISOString() ?? null,
            previousClosedById: session.closedById,
            reason,
          },
        },
      });

      // Reopen the session
      return tx.cashSession.update({
        where: { id: sessionId },
        data: {
          status: 'open',
          closedAt: null,
          closedById: null,
          closingAmount: null,
          difference: null,
        },
        include: { cashRegister: true, closedBy: true, openedBy: true },
      }) as Promise<CashSessionWithDetails>;
    });

    // Invalidate the income statement snapshot for the day this session was in
    const dateStr = getZonedCalendarDate(reopenedSession.openedAt);
    await incomeStatementRepository.invalidateSnapshot(dateStr);

    // Dispatch notification after transaction completes
    await createCashNotification({
      title: 'Reapertura de sesión de caja',
      message: `La caja ${reopenedSession.cashRegister.name} fue reabierta por reapertura manual. Motivo: ${reason}`,
      referenceId: reopenedSession.id,
    });

    return reopenedSession;
  },
};

async function prismaTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(callback, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

async function createCashNotification(
  data: { title: string; message: string; referenceId: string },
) {
  const recipients = await UserRepository.findActiveByRoleNames(['ADMIN', 'CAJERO']);

  await NotificationService.createNotification(
    { ...data, type: NotificationType.GENERAL },
    recipients.map(({ id }) => id),
    );
}
