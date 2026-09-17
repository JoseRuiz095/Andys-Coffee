import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const DISTRIBUTION_PREFERENCE_KEYS = {
  savingsPercent: 'income_statement.distribution.savings_percent',
  businessFundPercent: 'income_statement.distribution.business_fund_percent',
  suppliesPercent: 'income_statement.distribution.supplies_percent',
} as const;

const DEFAULT_DISTRIBUTION_PERCENTAGES = {
  savingsPercent: 10,
  businessFundPercent: 20,
  suppliesPercent: 70,
};

export interface SessionRangeRow {
  id: string;
  cashRegisterId: string;
  cashRegisterName: string;
  openingAmount: Prisma.Decimal;
  expectedAmount: Prisma.Decimal;
  closingAmount: Prisma.Decimal | null;
  difference: Prisma.Decimal | null;
  status: string;
  openedAt: Date;
  closedAt: Date | null;
  closingReason: string | null;
  openedByName: string;
  closedByName: string | null;
}

export interface PaymentRangeRow {
  amount: Prisma.Decimal;
  method: string;
  orderCreatedAt: Date;
  cashRegisterId: string | null;
}

export interface CogsRangeRow {
  costSnapshot: Prisma.Decimal | null;
  orderCreatedAt: Date;
}

export interface ExpenseRangeRow {
  id: string;
  amount: Prisma.Decimal;
  paymentMethod: string;
  category: string;
  description: string;
  expenseDate: Date;
  cashSessionId: string | null;
  cashRegisterId: string | null;
  createdByName: string | null;
}

export const incomeStatementRepository = {
  async findSessionsInRange(from: Date, to: Date, cashRegisterId?: string): Promise<SessionRangeRow[]> {
    const sessions = await prisma.cashSession.findMany({
      where: {
        openedAt: { gte: from, lt: to },
        ...(cashRegisterId && { cashRegisterId }),
      },
      select: {
        id: true,
        cashRegisterId: true,
        openingAmount: true,
        expectedAmount: true,
        closingAmount: true,
        difference: true,
        status: true,
        openedAt: true,
        closedAt: true,
        closingReason: true,
        cashRegister: { select: { name: true } },
        openedBy: { select: { name: true } },
        closedBy: { select: { name: true } },
      },
      orderBy: { openedAt: 'asc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      cashRegisterId: s.cashRegisterId,
      cashRegisterName: s.cashRegister.name,
      openingAmount: s.openingAmount,
      expectedAmount: s.expectedAmount,
      closingAmount: s.closingAmount,
      difference: s.difference,
      status: s.status,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      closingReason: s.closingReason,
      openedByName: s.openedBy.name,
      closedByName: s.closedBy?.name ?? null,
    }));
  },

  async findPaymentsInRange(from: Date, to: Date, cashRegisterId?: string): Promise<PaymentRangeRow[]> {
    const payments = await prisma.payment.findMany({
      where: {
        status: 'paid',
        order: {
          status: 'completed',
          createdAt: { gte: from, lt: to },
          ...(cashRegisterId && { cashSession: { cashRegisterId } }),
        },
      },
      select: {
        amount: true,
        method: true,
        order: { select: { createdAt: true, cashSession: { select: { cashRegisterId: true } } } },
      },
    });

    return payments.map((p) => ({
      amount: p.amount,
      method: p.method,
      orderCreatedAt: p.order.createdAt,
      cashRegisterId: p.order.cashSession?.cashRegisterId ?? null,
    }));
  },

  async findCogsInRange(from: Date, to: Date, cashRegisterId?: string): Promise<CogsRangeRow[]> {
    const items = await prisma.orderItem.findMany({
      where: {
        order: {
          status: 'completed',
          createdAt: { gte: from, lt: to },
          ...(cashRegisterId && { cashSession: { cashRegisterId } }),
        },
      },
      select: {
        costSnapshot: true,
        order: { select: { createdAt: true } },
      },
    });

    return items.map((i) => ({ costSnapshot: i.costSnapshot, orderCreatedAt: i.order.createdAt }));
  },

  async findExpensesInRange(from: Date, to: Date, cashRegisterId?: string): Promise<ExpenseRangeRow[]> {
    const expenses = await prisma.expense.findMany({
      where: {
        expenseDate: { gte: from, lt: to },
        ...(cashRegisterId && { cashSession: { cashRegisterId } }),
      },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        category: true,
        description: true,
        expenseDate: true,
        cashSessionId: true,
        cashSession: { select: { cashRegisterId: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { expenseDate: 'asc' },
    });

    return expenses.map((e) => ({
      id: e.id,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      category: e.category,
      description: e.description,
      expenseDate: e.expenseDate,
      cashSessionId: e.cashSessionId,
      cashRegisterId: e.cashSession?.cashRegisterId ?? null,
      createdByName: e.createdBy?.name ?? null,
    }));
  },

  async findLatestFinalSnapshotBefore(dateStr: string) {
    return prisma.incomeStatementDailySnapshot.findFirst({
      where: { isFinal: true, date: { lt: new Date(`${dateStr}T00:00:00Z`) } },
      orderBy: { date: 'desc' },
    });
  },

  async findSnapshot(dateStr: string) {
    return prisma.incomeStatementDailySnapshot.findUnique({
      where: { date: new Date(`${dateStr}T00:00:00Z`) },
    });
  },

  async upsertSnapshot(dateStr: string, data: Omit<Prisma.IncomeStatementDailySnapshotCreateInput, 'date'>) {
    const date = new Date(`${dateStr}T00:00:00Z`);
    return prisma.incomeStatementDailySnapshot.upsert({
      where: { date },
      update: data,
      create: { ...data, date },
    });
  },

  async getDistributionPreferences() {
    const rows = await prisma.systemPreference.findMany({
      where: { key: { in: Object.values(DISTRIBUTION_PREFERENCE_KEYS) } },
    });
    const byKey = new Map(rows.map((r) => [r.key, r]));

    const read = (key: string, fallback: number) => {
      const row = byKey.get(key);
      if (!row) return fallback;
      const parsed = Number(row.value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    return {
      savingsPercent: read(DISTRIBUTION_PREFERENCE_KEYS.savingsPercent, DEFAULT_DISTRIBUTION_PERCENTAGES.savingsPercent),
      businessFundPercent: read(
        DISTRIBUTION_PREFERENCE_KEYS.businessFundPercent,
        DEFAULT_DISTRIBUTION_PERCENTAGES.businessFundPercent,
      ),
      suppliesPercent: read(DISTRIBUTION_PREFERENCE_KEYS.suppliesPercent, DEFAULT_DISTRIBUTION_PERCENTAGES.suppliesPercent),
    };
  },

  async setDistributionPreferences(input: { savingsPercent: number; businessFundPercent: number; suppliesPercent: number }) {
    await prisma.$transaction([
      prisma.systemPreference.upsert({
        where: { key: DISTRIBUTION_PREFERENCE_KEYS.savingsPercent },
        update: { value: String(input.savingsPercent), type: 'number' },
        create: {
          key: DISTRIBUTION_PREFERENCE_KEYS.savingsPercent,
          value: String(input.savingsPercent),
          type: 'number',
          label: 'Ahorro (%)',
        },
      }),
      prisma.systemPreference.upsert({
        where: { key: DISTRIBUTION_PREFERENCE_KEYS.businessFundPercent },
        update: { value: String(input.businessFundPercent), type: 'number' },
        create: {
          key: DISTRIBUTION_PREFERENCE_KEYS.businessFundPercent,
          value: String(input.businessFundPercent),
          type: 'number',
          label: 'Fondo del Negocio (%)',
        },
      }),
      prisma.systemPreference.upsert({
        where: { key: DISTRIBUTION_PREFERENCE_KEYS.suppliesPercent },
        update: { value: String(input.suppliesPercent), type: 'number' },
        create: {
          key: DISTRIBUTION_PREFERENCE_KEYS.suppliesPercent,
          value: String(input.suppliesPercent),
          type: 'number',
          label: 'Surtido (%)',
        },
      }),
    ]);

    return this.getDistributionPreferences();
  },
};
