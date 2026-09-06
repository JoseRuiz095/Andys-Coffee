import { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { CashRepository, type CashSessionWithDetails } from '../repositories/cash.repository';
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
    return prismaTransaction(async (tx) => {
      const session = await CashRepository.findActiveSessionInTransaction(tx);
      if (!session) return null;

      const closingAmount = new Prisma.Decimal(input.closingAmount);
      const difference = closingAmount.sub(session.expectedAmount);
      if (!difference.isZero() && !input.reason) {
        throw new CashBusinessRuleError('Debes indicar un motivo cuando existe una diferencia.');
      }

      const closedSession = await CashRepository.closeActiveSession(
        tx,
        closedById,
        closingAmount,
        input.reason ?? 'Cierre de caja sin diferencia',
        input.comment,
      );

      if (closedSession) {
        const differenceLabel = closedSession.difference?.isNegative()
          ? `-$${closedSession.difference.abs().toFixed(2)}`
          : `$${closedSession.difference?.toFixed(2) ?? '0.00'}`;
        await createCashNotification(tx, {
          title: 'Cierre de caja confirmado',
          message: `La caja ${closedSession.cashRegister.name} fue cerrada. Efectivo contado: $${closingAmount.toFixed(2)}. Diferencia: ${differenceLabel}.`,
          referenceId: closedSession.id,
        });
      }

      return closedSession;
    });
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
      timeZone: process.env.CASH_TIMEZONE || 'America/Mexico_City',
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
      return await prismaTransaction(async (tx) => {
        const register = await CashRepository.findActiveRegister(tx, input.cashRegisterId);
        if (!register) {
          throw new CashBusinessRuleError('No hay una caja activa disponible.');
        }

        const activeSession = await CashRepository.findActiveSessionForRegister(tx, register.id);
        if (activeSession) {
          throw new CashBusinessRuleError('Ya existe una sesión abierta para esta caja.');
        }

        const session = await CashRepository.createSessionWithOpening(tx, {
          cashRegisterId: register.id,
          openedById,
          openingAmount: new Prisma.Decimal(input.openingAmount),
        });

        await createCashNotification(tx, {
          title: 'Apertura de caja confirmada',
          message: `La caja ${session.cashRegister.name} fue abierta por ${session.openedBy.name}. Fondo inicial: $${session.openingAmount.toFixed(2)}.`,
          referenceId: session.id,
        });

        return session;
      });
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
  tx: Prisma.TransactionClient,
  data: { title: string; message: string; referenceId: string },
) {
  const recipients = await tx.user.findMany({
    where: {
      isActive: true,
      role: { name: { in: ['ADMIN', 'CAJERO'], mode: 'insensitive' } },
    },
    select: { id: true },
  });

  await NotificationService.createNotification(
    { ...data, type: NotificationType.GENERAL },
    recipients.map(({ id }) => id),
    tx,
  );
}
