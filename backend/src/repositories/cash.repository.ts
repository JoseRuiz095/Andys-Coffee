import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

const sessionInclude = {
  cashRegister: true,
  openedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.CashSessionInclude;

export type CashSessionWithDetails = Prisma.CashSessionGetPayload<{
  include: typeof sessionInclude;
}>;

export const CashRepository = {
  async findActiveSession(cashRegisterId?: string): Promise<CashSessionWithDetails | null> {
    return prisma.cashSession.findFirst({
      where: { status: 'open', ...(cashRegisterId ? { cashRegisterId } : {}) },
      orderBy: { openedAt: 'desc' },
      include: sessionInclude,
    });
  },

  async findActiveRegister(tx: Prisma.TransactionClient, cashRegisterId?: string) {
    return tx.cashRegister.findFirst({
      where: {
        isActive: true,
        ...(cashRegisterId ? { id: cashRegisterId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async findActiveSessionForRegister(tx: Prisma.TransactionClient, cashRegisterId: string) {
    return tx.cashSession.findFirst({
      where: { cashRegisterId, status: 'open' },
      include: sessionInclude,
    });
  },

  async closeActiveSession(
    tx: Prisma.TransactionClient,
    closedById: string,
    reason: string,
  ): Promise<CashSessionWithDetails | null> {
    const session = await tx.cashSession.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' },
    });
    if (!session) return null;

    return tx.cashSession.update({
      where: { id: session.id },
      data: {
        status: 'closed',
        closedById,
        closedAt: new Date(),
        closingAmount: session.expectedAmount,
        difference: new Prisma.Decimal(0),
        movements: {
          create: {
            type: 'CLOSING',
            amount: session.expectedAmount,
            description: reason,
            createdById: closedById,
          },
        },
      },
      include: sessionInclude,
    });
  },

  async createSessionWithOpening(
    tx: Prisma.TransactionClient,
    data: { cashRegisterId: string; openedById: string; openingAmount: Prisma.Decimal },
  ) {
    const session = await tx.cashSession.create({
      data: {
        ...data,
        expectedAmount: data.openingAmount,
        status: 'open',
      },
      include: sessionInclude,
    });

    await tx.cashMovement.create({
      data: {
        cashSessionId: session.id,
        type: 'OPENING',
        amount: data.openingAmount,
        description: 'Apertura de caja',
        createdById: data.openedById,
      },
    });

    return session;
  },
};
