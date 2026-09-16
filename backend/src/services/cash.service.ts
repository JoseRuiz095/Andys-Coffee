import { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { CASH_TIMEZONE } from '../config/app';
import { CashRepository, type CashSessionWithDetails } from '../repositories/cash.repository';
import { UserRepository } from '../repositories/user.repository';
import type { CloseCashSessionInput, CorrectCashClosingInput, OpenCashSessionInput } from '../validators/cash.validator';
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
      const differenceLabel = closedSession.difference?.isNegative()
        ? `-$${closedSession.difference.abs().toFixed(2)}`
        : `$${closedSession.difference?.toFixed(2) ?? '0.00'}`;
      await createCashNotification({
        title: 'Cierre de caja confirmado',
        message: `La caja ${closedSession.cashRegister.name} fue cerrada. Efectivo contado: $${closedSession.closingAmount?.toFixed(2) ?? '0.00'}. Diferencia: ${differenceLabel}.`,
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

    return correctedSession;
  },

  async closeIfBusinessDayEnded(closedById: string): Promise<CashSessionWithDetails | null> {
    const hour = Number(new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: CASH_TIMEZONE,
    }).format(new Date()));
    if (hour < 14) return null;
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
