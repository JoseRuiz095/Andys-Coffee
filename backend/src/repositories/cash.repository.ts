import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { paginationOffset } from '../utils/pagination';
import { getZonedDayBoundaries } from '../utils/businessDate';
import { AUTO_CLOSE_REASON } from '../config/app';
import type { DbClient, Tx } from './transaction';

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
      data: {
        closingAmount: correctedAmount,
        difference: correctedDifference,
        // A correction is a real count: an uncounted auto-close stops being reported as such
        // (the original reason stays in the audit log below).
        ...(session.closingReason === AUTO_CLOSE_REASON && { closingReason: reason }),
      },
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
    // Business-calendar days (CASH_TIMEZONE), not UTC days.
    const range = {
      gte: filters.startDate ? getZonedDayBoundaries(filters.startDate).start : undefined,
      lt: filters.endDate ? getZonedDayBoundaries(filters.endDate).end : undefined,
    };

    const where: Prisma.CashSessionWhereInput = {
      ...(filters.cashRegisterId && { cashRegisterId: filters.cashRegisterId }),
      ...(filters.status && { status: filters.status }),
      ...((range.gte || range.lt) && {
        openedAt: {
          ...(range.gte && { gte: range.gte }),
          ...(range.lt && { lt: range.lt }),
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

  async findSessionForReopen(tx: Tx, sessionId: string) {
    return tx.cashSession.findUnique({ where: { id: sessionId } });
  },

  /** Puts a closed session back to open, clearing its closing count. */
  async reopenSession(tx: Tx, sessionId: string): Promise<CashSessionWithDetails> {
    return tx.cashSession.update({
      where: { id: sessionId },
      data: { status: 'open', closedAt: null, closedById: null, closingAmount: null, difference: null },
      include: sessionInclude,
    });
  },

  /** Latest open session (optionally a specific one), inside a transaction. */
  async findOpenSession(tx: Tx, sessionId?: string) {
    return tx.cashSession.findFirst({
      where: { status: 'open', ...(sessionId ? { id: sessionId } : {}) },
      orderBy: { openedAt: 'desc' },
    });
  },

  async findSessionStatus(tx: Tx, sessionId: string) {
    return tx.cashSession.findUnique({ where: { id: sessionId }, select: { status: true } });
  },

  /**
   * Records a cash movement and applies its effect to the session's expectedAmount in the
   * same transaction. `drawerEffect` is how much the drawer changes (+ money in, − money out);
   * it is explicit because the stored `amount` sign is not uniform across movement types
   * (see jobs/cashReconciliation.job.ts).
   */
  async recordMovement(
    tx: Tx,
    data: {
      cashSessionId: string;
      type: string;
      amount: Prisma.Decimal;
      drawerEffect: Prisma.Decimal;
      referenceType?: string;
      referenceId?: string;
      description?: string;
      receivedAmount?: Prisma.Decimal | null;
      changeAmount?: Prisma.Decimal | null;
      createdById: string;
    },
  ) {
    const { drawerEffect, ...movement } = data;
    const created = await tx.cashMovement.create({ data: movement });
    await tx.cashSession.update({
      where: { id: data.cashSessionId },
      data: { expectedAmount: { increment: drawerEffect } },
    });
    return created;
  },

  async findMovements(
    tx: DbClient,
    where: { referenceType: string; referenceId: string; type: string; cashSessionId?: string },
  ) {
    return tx.cashMovement.findMany({ where });
  },

  async findFirstMovement(tx: Tx, where: { referenceType: string; referenceId: string; type: string }) {
    return tx.cashMovement.findFirst({ where });
  },

  /** Received/change amounts of the cash sale of each order (for the daily orders view). */
  async findSaleTenderByOrderIds(orderIds: string[]) {
    return prisma.cashMovement.findMany({
      where: { referenceType: 'order', referenceId: { in: orderIds }, type: 'sale' },
      select: { referenceId: true, receivedAmount: true, changeAmount: true },
    });
  },

  /** Closed sessions opened in [from, to) with their movements, for the reconciliation job. */
  async findClosedSessionsWithMovements(from: Date, to: Date) {
    return prisma.cashSession.findMany({
      where: { openedAt: { gte: from, lt: to }, status: 'closed' },
      include: { cashRegister: true, movements: { select: { type: true, amount: true } } },
    });
  },
};
