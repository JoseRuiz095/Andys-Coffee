import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { CashRepository, type CashSessionWithDetails } from '../repositories/cash.repository';
import type { OpenCashSessionInput } from '../validators/cash.validator';

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

  async closeSession(closedById: string, reason = 'Cierre de caja'): Promise<CashSessionWithDetails | null> {
    return prismaTransaction((tx) => CashRepository.closeActiveSession(tx, closedById, reason));
  },

  async closeIfBusinessDayEnded(closedById: string): Promise<CashSessionWithDetails | null> {
    const now = new Date();
    if (now.getHours() < 14) return null;
    return this.closeSession(closedById, 'Cierre automático al finalizar la jornada');
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

        return CashRepository.createSessionWithOpening(tx, {
          cashRegisterId: register.id,
          openedById,
          openingAmount: new Prisma.Decimal(input.openingAmount),
        });
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
