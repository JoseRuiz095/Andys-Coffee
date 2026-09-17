import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { paginationOffset } from '../utils/pagination';

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

  async findActiveSessionInTransaction(tx: Prisma.TransactionClient) {
    return tx.cashSession.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' },
    });
  },

  async closeActiveSession(
    tx: Prisma.TransactionClient,
    session: { id: string; expectedAmount: Prisma.Decimal },
    closedById: string,
    closingAmount: Prisma.Decimal,
    reason: string,
    comment?: string,
  ): Promise<CashSessionWithDetails | null> {
    const difference = closingAmount.sub(session.expectedAmount);
    const closedSession = await tx.cashSession.update({
      where: { id: session.id },
      data: {
        status: 'closed',
        closedById,
        closedAt: new Date(),
        closingAmount,
        difference,
        closingReason: reason,
        closingComment: comment,
        movements: {
          create: {
            type: 'CLOSING',
            amount: closingAmount,
            description: reason,
            createdById: closedById,
          },
        },
      },
      include: sessionInclude,
    });

    await tx.auditLog.create({
      data: {
        userId: closedById,
        action: 'CASH_SESSION_CLOSED',
        cashSessionId: session.id,
        metadata: {
          closingAmount: closingAmount.toString(),
          expectedAmount: session.expectedAmount.toString(),
          difference: difference.toString(),
          reason,
          comment: comment ?? null,
        },
      },
    });

    return closedSession;
  },

  async correctClosedSession(
    tx: Prisma.TransactionClient,
    sessionId: string,
    correctedById: string,
    correctedAmount: Prisma.Decimal,
    reason: string,
    comment?: string,
  ): Promise<CashSessionWithDetails | null> {
    const session = await tx.cashSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== 'closed' || session.closingAmount === null) return null;

    const correctedDifference = correctedAmount.sub(session.expectedAmount);
    const correctedSession = await tx.cashSession.update({
      where: { id: session.id },
      data: { closingAmount: correctedAmount, difference: correctedDifference },
      include: sessionInclude,
    });

    await tx.auditLog.create({
      data: {
        userId: correctedById,
        action: 'CASH_SESSION_CLOSING_CORRECTED',
        cashSessionId: session.id,
        metadata: {
          originalClosingAmount: session.closingAmount.toString(),
          correctedClosingAmount: correctedAmount.toString(),
          originalDifference: session.difference?.toString() ?? null,
          correctedDifference: correctedDifference.toString(),
          reason,
          comment: comment ?? null,
        },
      },
    });

    return correctedSession;
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

  async findSessionsHistory(
    filters: { startDate?: string; endDate?: string; cashRegisterId?: string; status?: string },
    page: number,
    limit: number,
  ) {
    const skip = paginationOffset(page, limit);
    const range = {
      gte: filters.startDate ? new Date(`${filters.startDate}T00:00:00.000Z`) : undefined,
      lte: filters.endDate ? new Date(`${filters.endDate}T23:59:59.999Z`) : undefined,
    };

    const where: Prisma.CashSessionWhereInput = {
      ...(filters.cashRegisterId && { cashRegisterId: filters.cashRegisterId }),
      ...(filters.status && { status: filters.status }),
      ...((range.gte || range.lte) && {
        openedAt: {
          ...(range.gte && { gte: range.gte }),
          ...(range.lte && { lte: range.lte }),
        },
      }),
    };

    const [sessions, total] = await Promise.all([
      prisma.cashSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { openedAt: 'desc' },
        include: sessionInclude,
      }),
      prisma.cashSession.count({ where }),
    ]);

    return { sessions, total };
  },
};
