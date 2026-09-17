import { Prisma } from '@prisma/client';
import {
  incomeStatementRepository,
  type SessionRangeRow,
  type PaymentRangeRow,
  type CogsRangeRow,
  type ExpenseRangeRow,
} from '../repositories/income-statement.repository';
import {
  getZonedDayBoundaries,
  getZonedCalendarDate,
  getTodayInZone,
  getWeekRange,
  getMonthRange,
  addCalendarDays,
} from '../utils/businessDate';
import type { DistributionSettingsInput } from '../validators/income-statement.validator';

export class IncomeStatementBusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}

type CashStatus = 'CUADRADA' | 'SOBRANTE' | 'FALTANTE' | 'PENDIENTE' | null;

export interface DistributionPercentages {
  savingsPercent: number;
  businessFundPercent: number;
  suppliesPercent: number;
}

export interface DayFinancialSummary {
  date: string;
  hadOperation: boolean;
  movimientos: {
    ingresosEfectivo: number;
    ingresosTransferencia: number;
    ingresosOtros: number;
    ingresosTotales: number;
    costoVenta: number;
    gananciaBruta: number;
    gastos: number;
    gananciaNeta: number;
  };
  conciliacion: {
    fondoInicial: number;
    efectivoEsperado: number | null;
    efectivoReal: number | null;
    diferencia: number | null;
    estado: CashStatus;
    sessionsCount: number;
    openSessionsCount: number;
  };
  distribucion: {
    ahorro: number;
    fondoNegocio: number;
    surtido: number;
    porcentajes: { ahorro: number; fondoNegocio: number; surtido: number };
  };
  saldosAcumulados: {
    ahorroAcumulado: number;
    fondoNegocioAcumulado: number;
    surtidoAcumulado: number;
  };
}

export interface DayDetailResponse extends DayFinancialSummary {
  sessions: Array<{
    id: string;
    cashRegisterName: string;
    openedAt: Date;
    closedAt: Date | null;
    openedByName: string;
    closedByName: string | null;
    openingAmount: number;
    expectedAmount: number;
    closingAmount: number | null;
    difference: number | null;
    status: string;
    closingReason: string | null;
  }>;
  expenses: Array<{
    id: string;
    category: string;
    description: string;
    amount: number;
    paymentMethod: string;
    expenseDate: Date;
    createdByName: string | null;
  }>;
  paymentsBreakdown: Array<{ method: string; amount: number; count: number }>;
}

export interface PeriodTotals {
  ingresosEfectivo: number;
  ingresosTransferencia: number;
  ingresosOtros: number;
  ingresosTotales: number;
  costoVenta: number;
  gananciaBruta: number;
  gastos: number;
  gananciaNeta: number;
  ahorro: number;
  fondoNegocio: number;
  surtido: number;
  lastAccumulated: { ahorroAcumulado: number; fondoNegocioAcumulado: number; surtidoAcumulado: number };
}

export interface DaySubsetRows {
  sessions: SessionRangeRow[];
  payments: PaymentRangeRow[];
  cogsRows: CogsRangeRow[];
  expenses: ExpenseRangeRow[];
}

export interface DayCore {
  hadOperation: boolean;
  cashRevenue: Prisma.Decimal;
  transferRevenue: Prisma.Decimal;
  otherRevenue: Prisma.Decimal;
  totalRevenue: Prisma.Decimal;
  totalCogs: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
  totalExpenses: Prisma.Decimal;
  netProfit: Prisma.Decimal;
  openingFund: Prisma.Decimal;
  expectedCash: Prisma.Decimal | null;
  actualCash: Prisma.Decimal | null;
  cashDifference: Prisma.Decimal | null;
  cashStatus: CashStatus;
  sessionsCount: number;
  openSessionsCount: number;
  savingsAmount: Prisma.Decimal;
  businessFundAmount: Prisma.Decimal;
  suppliesAmount: Prisma.Decimal;
}

const ZERO = new Prisma.Decimal(0);

function sumDecimals<T>(rows: T[], pick: (row: T) => Prisma.Decimal | null): Prisma.Decimal {
  return rows.reduce((acc, row) => acc.plus(pick(row) ?? ZERO), ZERO);
}

function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function computeDayCore(rows: DaySubsetRows, percentages: DistributionPercentages): DayCore {
  const cashPayments = rows.payments.filter((p) => p.method === 'cash');
  const transferPayments = rows.payments.filter((p) => p.method === 'transfer');
  const otherPayments = rows.payments.filter((p) => p.method !== 'cash' && p.method !== 'transfer');

  const cashRevenue = sumDecimals(cashPayments, (p) => p.amount);
  const transferRevenue = sumDecimals(transferPayments, (p) => p.amount);
  const otherRevenue = sumDecimals(otherPayments, (p) => p.amount);
  const totalRevenue = cashRevenue.plus(transferRevenue).plus(otherRevenue);

  const totalCogs = sumDecimals(rows.cogsRows, (i) => i.costSnapshot);
  const grossProfit = totalRevenue.minus(totalCogs);

  const totalExpenses = sumDecimals(rows.expenses, (e) => e.amount);
  const netProfit = grossProfit.minus(totalExpenses);

  const openingFund = sumDecimals(rows.sessions, (s) => s.openingAmount);
  const hadOperation = rows.sessions.length > 0 || rows.payments.length > 0 || rows.expenses.length > 0;

  const openSessionsCount = rows.sessions.filter((s) => s.status === 'open').length;
  let expectedCash: Prisma.Decimal | null = null;
  let actualCash: Prisma.Decimal | null = null;
  let cashDifference: Prisma.Decimal | null = null;
  let cashStatus: CashStatus = null;

  if (rows.sessions.length > 0) {
    expectedCash = sumDecimals(rows.sessions, (s) => s.expectedAmount);
    if (openSessionsCount > 0) {
      cashStatus = 'PENDIENTE';
    } else {
      actualCash = sumDecimals(rows.sessions, (s) => s.closingAmount);
      cashDifference = actualCash.minus(expectedCash);
      cashStatus = cashDifference.isZero() ? 'CUADRADA' : cashDifference.greaterThan(0) ? 'SOBRANTE' : 'FALTANTE';
    }
  }

  let savingsAmount = ZERO;
  let businessFundAmount = ZERO;
  let suppliesAmount = ZERO;
  if (netProfit.greaterThan(0)) {
    savingsAmount = round2(netProfit.times(percentages.savingsPercent).dividedBy(100));
    businessFundAmount = round2(netProfit.times(percentages.businessFundPercent).dividedBy(100));
    // Supplies absorbs the rounding residual so the three amounts always sum exactly to netProfit.
    suppliesAmount = netProfit.minus(savingsAmount).minus(businessFundAmount);
  }

  return {
    hadOperation,
    cashRevenue,
    transferRevenue,
    otherRevenue,
    totalRevenue,
    totalCogs,
    grossProfit,
    totalExpenses,
    netProfit,
    openingFund,
    expectedCash,
    actualCash,
    cashDifference,
    cashStatus,
    sessionsCount: rows.sessions.length,
    openSessionsCount,
    savingsAmount,
    businessFundAmount,
    suppliesAmount,
  };
}

function toNum(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

function buildSummaryDto(
  dateStr: string,
  core: DayCore,
  percentages: DistributionPercentages,
  accumulated: { savingsAccumulated: Prisma.Decimal; businessFundAccumulated: Prisma.Decimal; suppliesAccumulated: Prisma.Decimal },
): DayFinancialSummary {
  return {
    date: dateStr,
    hadOperation: core.hadOperation,
    movimientos: {
      ingresosEfectivo: core.cashRevenue.toNumber(),
      ingresosTransferencia: core.transferRevenue.toNumber(),
      ingresosOtros: core.otherRevenue.toNumber(),
      ingresosTotales: core.totalRevenue.toNumber(),
      costoVenta: core.totalCogs.toNumber(),
      gananciaBruta: core.grossProfit.toNumber(),
      gastos: core.totalExpenses.toNumber(),
      gananciaNeta: core.netProfit.toNumber(),
    },
    conciliacion: {
      fondoInicial: core.openingFund.toNumber(),
      efectivoEsperado: toNum(core.expectedCash),
      efectivoReal: toNum(core.actualCash),
      diferencia: toNum(core.cashDifference),
      estado: core.cashStatus,
      sessionsCount: core.sessionsCount,
      openSessionsCount: core.openSessionsCount,
    },
    distribucion: {
      ahorro: core.savingsAmount.toNumber(),
      fondoNegocio: core.businessFundAmount.toNumber(),
      surtido: core.suppliesAmount.toNumber(),
      porcentajes: {
        ahorro: percentages.savingsPercent,
        fondoNegocio: percentages.businessFundPercent,
        surtido: percentages.suppliesPercent,
      },
    },
    saldosAcumulados: {
      ahorroAcumulado: accumulated.savingsAccumulated.toNumber(),
      fondoNegocioAcumulado: accumulated.businessFundAccumulated.toNumber(),
      surtidoAcumulado: accumulated.suppliesAccumulated.toNumber(),
    },
  };
}

function bucketRows(dateStrs: string[], sessions: SessionRangeRow[], payments: PaymentRangeRow[], cogsRows: CogsRangeRow[], expenses: ExpenseRangeRow[]) {
  const byDay = new Map<string, DaySubsetRows>(dateStrs.map((d) => [d, { sessions: [], payments: [], cogsRows: [], expenses: [] }]));

  for (const s of sessions) {
    const bucket = byDay.get(getZonedCalendarDate(s.openedAt));
    if (bucket) bucket.sessions.push(s);
  }
  for (const p of payments) {
    const bucket = byDay.get(getZonedCalendarDate(p.orderCreatedAt));
    if (bucket) bucket.payments.push(p);
  }
  for (const c of cogsRows) {
    const bucket = byDay.get(getZonedCalendarDate(c.orderCreatedAt));
    if (bucket) bucket.cogsRows.push(c);
  }
  for (const e of expenses) {
    const bucket = byDay.get(getZonedCalendarDate(e.expenseDate));
    if (bucket) bucket.expenses.push(e);
  }

  return byDay;
}

/** A day with no sales/expenses, or a net loss, never distributes and never moves accumulated saldos. */
export function shouldCarryForwardAccumulated(core: DayCore): boolean {
  return !core.hadOperation || core.netProfit.lessThanOrEqualTo(0);
}

/**
 * Computes DayFinancialSummary for every date in `dateStrs` (must be in
 * ascending chronological order). Fetches each data source exactly once for
 * the whole span, then buckets rows into per-day subsets in memory — never
 * one query per day. Accumulated saldos chain day-to-day in memory; only the
 * first day looks up its starting point from the last finalized snapshot.
 */
async function computeDaySequence(dateStrs: string[], cashRegisterId?: string): Promise<DayFinancialSummary[]> {
  if (dateStrs.length === 0) return [];

  const { start } = getZonedDayBoundaries(dateStrs[0]);
  const { end } = getZonedDayBoundaries(dateStrs[dateStrs.length - 1]);

  const [sessions, payments, cogsRows, expenses, percentages, prevSnapshot] = await Promise.all([
    incomeStatementRepository.findSessionsInRange(start, end, cashRegisterId),
    incomeStatementRepository.findPaymentsInRange(start, end, cashRegisterId),
    incomeStatementRepository.findCogsInRange(start, end, cashRegisterId),
    incomeStatementRepository.findExpensesInRange(start, end, cashRegisterId),
    incomeStatementRepository.getDistributionPreferences(),
    incomeStatementRepository.findLatestFinalSnapshotBefore(dateStrs[0]),
  ]);

  const byDay = bucketRows(dateStrs, sessions, payments, cogsRows, expenses);
  const today = getTodayInZone();

  let runningSavings = prevSnapshot?.savingsAccumulated ?? ZERO;
  let runningBusinessFund = prevSnapshot?.businessFundAccumulated ?? ZERO;
  let runningSupplies = prevSnapshot?.suppliesAccumulated ?? ZERO;

  const summaries: DayFinancialSummary[] = [];

  for (const dateStr of dateStrs) {
    const rows = byDay.get(dateStr)!;
    const core = computeDayCore(rows, percentages);

    const carryForward = shouldCarryForwardAccumulated(core);
    if (!carryForward) {
      runningSavings = runningSavings.plus(core.savingsAmount);
      runningBusinessFund = runningBusinessFund.plus(core.businessFundAmount);
      runningSupplies = runningSupplies.plus(core.suppliesAmount);
    }

    const accumulated = {
      savingsAccumulated: runningSavings,
      businessFundAccumulated: runningBusinessFund,
      suppliesAccumulated: runningSupplies,
    };

    const isFinal = dateStr < today && (core.sessionsCount === 0 || core.openSessionsCount === 0);
    if (isFinal) {
      // Write-through cache: only persisted once a day is truly closed out, so a snapshot is never
      // written for "today" or for a day that still has an open cash session.
      await incomeStatementRepository.upsertSnapshot(dateStr, {
        hadOperation: core.hadOperation,
        openingFund: core.openingFund,
        cashRevenue: core.cashRevenue,
        transferRevenue: core.transferRevenue,
        otherRevenue: core.otherRevenue,
        totalRevenue: core.totalRevenue,
        totalCogs: core.totalCogs,
        grossProfit: core.grossProfit,
        totalExpenses: core.totalExpenses,
        netProfit: core.netProfit,
        expectedCash: core.expectedCash,
        actualCash: core.actualCash,
        cashDifference: core.cashDifference,
        cashStatus: core.cashStatus,
        savingsAmount: core.savingsAmount,
        businessFundAmount: core.businessFundAmount,
        suppliesAmount: core.suppliesAmount,
        savingsAccumulated: runningSavings,
        businessFundAccumulated: runningBusinessFund,
        suppliesAccumulated: runningSupplies,
        savingsPercentUsed: new Prisma.Decimal(percentages.savingsPercent),
        businessFundPercentUsed: new Prisma.Decimal(percentages.businessFundPercent),
        suppliesPercentUsed: new Prisma.Decimal(percentages.suppliesPercent),
        isFinal: true,
      });
    }

    summaries.push(buildSummaryDto(dateStr, core, percentages, accumulated));
  }

  return summaries;
}

function computeTotals(days: DayFinancialSummary[]): PeriodTotals {
  const sum = (pick: (d: DayFinancialSummary) => number) => days.reduce((acc, d) => acc + pick(d), 0);
  const last = days[days.length - 1];

  return {
    ingresosEfectivo: sum((d) => d.movimientos.ingresosEfectivo),
    ingresosTransferencia: sum((d) => d.movimientos.ingresosTransferencia),
    ingresosOtros: sum((d) => d.movimientos.ingresosOtros),
    ingresosTotales: sum((d) => d.movimientos.ingresosTotales),
    costoVenta: sum((d) => d.movimientos.costoVenta),
    gananciaBruta: sum((d) => d.movimientos.gananciaBruta),
    gastos: sum((d) => d.movimientos.gastos),
    gananciaNeta: sum((d) => d.movimientos.gananciaNeta),
    ahorro: sum((d) => d.distribucion.ahorro),
    fondoNegocio: sum((d) => d.distribucion.fondoNegocio),
    surtido: sum((d) => d.distribucion.surtido),
    lastAccumulated: last
      ? {
          ahorroAcumulado: last.saldosAcumulados.ahorroAcumulado,
          fondoNegocioAcumulado: last.saldosAcumulados.fondoNegocioAcumulado,
          surtidoAcumulado: last.saldosAcumulados.surtidoAcumulado,
        }
      : { ahorroAcumulado: 0, fondoNegocioAcumulado: 0, surtidoAcumulado: 0 },
  };
}

export const incomeStatementService = {
  async getDistributionSettings() {
    return incomeStatementRepository.getDistributionPreferences();
  },

  async updateDistributionSettings(input: DistributionSettingsInput) {
    return incomeStatementRepository.setDistributionPreferences(input);
  },

  async getDayFinancials(dateStr: string, cashRegisterId?: string): Promise<DayFinancialSummary> {
    const [summary] = await computeDaySequence([dateStr], cashRegisterId);
    return summary;
  },

  async getDayDetail(dateStr: string, cashRegisterId?: string): Promise<DayDetailResponse> {
    const { start, end } = getZonedDayBoundaries(dateStr);
    const [sessions, payments, cogsRows, expenses, percentages, prevSnapshot] = await Promise.all([
      incomeStatementRepository.findSessionsInRange(start, end, cashRegisterId),
      incomeStatementRepository.findPaymentsInRange(start, end, cashRegisterId),
      incomeStatementRepository.findCogsInRange(start, end, cashRegisterId),
      incomeStatementRepository.findExpensesInRange(start, end, cashRegisterId),
      incomeStatementRepository.getDistributionPreferences(),
      incomeStatementRepository.findLatestFinalSnapshotBefore(dateStr),
    ]);

    const core = computeDayCore({ sessions, payments, cogsRows, expenses }, percentages);
    const carryForward = shouldCarryForwardAccumulated(core);
    const prevSavings = prevSnapshot?.savingsAccumulated ?? ZERO;
    const prevBusinessFund = prevSnapshot?.businessFundAccumulated ?? ZERO;
    const prevSupplies = prevSnapshot?.suppliesAccumulated ?? ZERO;
    const accumulated = {
      savingsAccumulated: carryForward ? prevSavings : prevSavings.plus(core.savingsAmount),
      businessFundAccumulated: carryForward ? prevBusinessFund : prevBusinessFund.plus(core.businessFundAmount),
      suppliesAccumulated: carryForward ? prevSupplies : prevSupplies.plus(core.suppliesAmount),
    };

    const summary = buildSummaryDto(dateStr, core, percentages, accumulated);

    const breakdownMap = new Map<string, { amount: Prisma.Decimal; count: number }>();
    for (const p of payments) {
      const entry = breakdownMap.get(p.method) ?? { amount: ZERO, count: 0 };
      entry.amount = entry.amount.plus(p.amount);
      entry.count += 1;
      breakdownMap.set(p.method, entry);
    }

    return {
      ...summary,
      sessions: sessions.map((s) => ({
        id: s.id,
        cashRegisterName: s.cashRegisterName,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        openedByName: s.openedByName,
        closedByName: s.closedByName,
        openingAmount: s.openingAmount.toNumber(),
        expectedAmount: s.expectedAmount.toNumber(),
        closingAmount: toNum(s.closingAmount),
        difference: toNum(s.difference),
        status: s.status,
        closingReason: s.closingReason,
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amount: e.amount.toNumber(),
        paymentMethod: e.paymentMethod,
        expenseDate: e.expenseDate,
        createdByName: e.createdByName,
      })),
      paymentsBreakdown: Array.from(breakdownMap.entries()).map(([method, v]) => ({
        method,
        amount: v.amount.toNumber(),
        count: v.count,
      })),
    };
  },

  async getWeekFinancials(dateStr: string, cashRegisterId?: string) {
    const { weekStart, weekEnd, days } = getWeekRange(dateStr);
    const daySummaries = await computeDaySequence(days, cashRegisterId);
    return { weekStart, weekEnd, days: daySummaries, totals: computeTotals(daySummaries) };
  },

  async getMonthFinancials(yearMonth: string, cashRegisterId?: string) {
    const { monthStart, monthEnd, days } = getMonthRange(yearMonth);
    const daySummaries = await computeDaySequence(days, cashRegisterId);
    return { month: yearMonth, monthStart, monthEnd, days: daySummaries, totals: computeTotals(daySummaries) };
  },

  async getRangeFinancials(from: string, to: string, cashRegisterId?: string) {
    const days: string[] = [];
    let cursor = from;
    while (cursor <= to) {
      days.push(cursor);
      cursor = addCalendarDays(cursor, 1);
    }
    const daySummaries = await computeDaySequence(days, cashRegisterId);
    return { from, to, days: daySummaries, totals: computeTotals(daySummaries) };
  },
};
