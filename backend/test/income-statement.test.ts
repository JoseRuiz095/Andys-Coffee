import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '@prisma/client';
import {
  computeDayCore,
  shouldCarryForwardAccumulated,
  type DaySubsetRows,
  type DistributionPercentages,
  type BusinessHours,
} from '../src/services/income-statement.service';
import type { SessionRangeRow, PaymentRangeRow, CogsRangeRow, ExpenseRangeRow } from '../src/repositories/income-statement.repository';

const BUSINESS_HOURS: BusinessHours = { openMinutes: 9 * 60, closeMinutes: 22 * 60 }; // 09:00-22:00

const money = (value: number) => new Prisma.Decimal(value);

const DEFAULT_PERCENTAGES: DistributionPercentages = {
  savingsPercent: 10,
  businessFundPercent: 20,
  suppliesPercent: 70,
};

function session(overrides: Partial<SessionRangeRow> = {}): SessionRangeRow {
  return {
    id: 'session-1',
    cashRegisterId: 'register-1',
    cashRegisterName: 'Caja principal',
    openingAmount: money(0),
    expectedAmount: money(0),
    closingAmount: null,
    difference: null,
    status: 'open',
    openedAt: new Date('2026-06-15T13:00:00.000Z'),
    closedAt: null,
    closingReason: null,
    openedByName: 'Cajero',
    closedByName: null,
    ...overrides,
  };
}

function payment(method: string, amount: number): PaymentRangeRow {
  return { amount: money(amount), method, orderCreatedAt: new Date('2026-06-15T14:00:00.000Z'), cashRegisterId: 'register-1' };
}

function cogs(amount: number): CogsRangeRow {
  return { costSnapshot: money(amount), orderCreatedAt: new Date('2026-06-15T14:00:00.000Z') };
}

function expense(paymentMethod: string, amount: number, expenseDate = new Date('2026-06-15T15:00:00.000Z')): ExpenseRangeRow {
  return {
    id: 'expense-1',
    amount: money(amount),
    paymentMethod,
    category: 'insumos',
    description: 'Gasto de prueba',
    expenseDate,
    cashSessionId: 'session-1',
    cashRegisterId: 'register-1',
    createdByName: 'Cajero',
  };
}

function emptyRows(): DaySubsetRows {
  return { sessions: [], payments: [], cogsRows: [], expenses: [], purchases: [] };
}

test('día normal: efectivo esperado = fondo inicial + ventas efectivo - gastos efectivo', () => {
  const rows: DaySubsetRows = {
    sessions: [session({ openingAmount: money(1000), expectedAmount: money(1400), status: 'open' })],
    payments: [payment('cash', 500), payment('transfer', 200)],
    cogsRows: [],
    expenses: [expense('cash', 100)],
    purchases: [],
  };

  const core = computeDayCore(rows, DEFAULT_PERCENTAGES);

  assert.equal(core.cashRevenue.toNumber(), 500);
  assert.equal(core.transferRevenue.toNumber(), 200);
  assert.equal(core.totalRevenue.toNumber(), 700);
  assert.equal(core.totalExpenses.toNumber(), 100);
  assert.equal(core.netProfit.toNumber(), 600);
  assert.equal(core.openingFund.toNumber(), 1000);
  assert.equal(core.expectedCash?.toNumber(), 1400);
  // Session is still open (no closingAmount recorded yet) -> conciliation is pending, not fabricated.
  assert.equal(core.cashStatus, 'PENDIENTE');
  assert.equal(core.actualCash, null);
});

test('faltante: efectivo real < efectivo esperado', () => {
  const rows: DaySubsetRows = {
    sessions: [session({ openingAmount: money(1000), expectedAmount: money(1400), closingAmount: money(1350), status: 'closed' })],
    payments: [],
    cogsRows: [],
    expenses: [],
    purchases: [],
  };

  const core = computeDayCore(rows, DEFAULT_PERCENTAGES);

  assert.equal(core.cashDifference?.toNumber(), -50);
  assert.equal(core.cashStatus, 'FALTANTE');
});

test('sobrante: efectivo real > efectivo esperado', () => {
  const rows: DaySubsetRows = {
    sessions: [session({ openingAmount: money(1000), expectedAmount: money(1400), closingAmount: money(1450), status: 'closed' })],
    payments: [],
    cogsRows: [],
    expenses: [],
    purchases: [],
  };

  const core = computeDayCore(rows, DEFAULT_PERCENTAGES);

  assert.equal(core.cashDifference?.toNumber(), 50);
  assert.equal(core.cashStatus, 'SOBRANTE');
});

test('caja cuadrada: efectivo real == efectivo esperado', () => {
  const rows: DaySubsetRows = {
    sessions: [session({ openingAmount: money(1000), expectedAmount: money(1400), closingAmount: money(1400), status: 'closed' })],
    payments: [],
    cogsRows: [],
    expenses: [],
    purchases: [],
  };

  const core = computeDayCore(rows, DEFAULT_PERCENTAGES);

  assert.equal(core.cashDifference?.toNumber(), 0);
  assert.equal(core.cashStatus, 'CUADRADA');
});

test('sin operación: no genera movimientos ni distribución, y no altera acumulados', () => {
  const core = computeDayCore(emptyRows(), DEFAULT_PERCENTAGES);

  assert.equal(core.hadOperation, false);
  assert.equal(core.sessionsCount, 0);
  assert.equal(core.cashStatus, null);
  assert.equal(core.expectedCash, null);
  assert.equal(core.savingsAmount.toNumber(), 0);
  assert.equal(core.businessFundAmount.toNumber(), 0);
  assert.equal(core.suppliesAmount.toNumber(), 0);
  assert.equal(shouldCarryForwardAccumulated(core), true);
});

test('día con pérdida neta: distribución en $0 y acumulados se conservan', () => {
  const rows: DaySubsetRows = {
    sessions: [],
    payments: [payment('cash', 100)],
    cogsRows: [],
    expenses: [expense('cash', 500)],
    purchases: [],
  };

  const core = computeDayCore(rows, DEFAULT_PERCENTAGES);

  assert.equal(core.netProfit.toNumber(), -400);
  assert.equal(core.savingsAmount.toNumber(), 0);
  assert.equal(core.businessFundAmount.toNumber(), 0);
  assert.equal(core.suppliesAmount.toNumber(), 0);
  assert.equal(shouldCarryForwardAccumulated(core), true);
});

test('distribución: ahorro y fondo se redondean primero, surtido absorbe el residuo (suma exacta a la ganancia neta)', () => {
  const rows: DaySubsetRows = {
    sessions: [],
    payments: [payment('cash', 100.01)],
    cogsRows: [],
    expenses: [],
    purchases: [],
  };

  const core = computeDayCore(rows, DEFAULT_PERCENTAGES);

  assert.equal(core.netProfit.toNumber(), 100.01);
  assert.equal(core.savingsAmount.toNumber(), 10.0);
  assert.equal(core.businessFundAmount.toNumber(), 20.0);
  assert.equal(core.suppliesAmount.toNumber(), 70.01);

  const sum = core.savingsAmount.plus(core.businessFundAmount).plus(core.suppliesAmount);
  assert.equal(sum.toNumber(), core.netProfit.toNumber());
  assert.equal(shouldCarryForwardAccumulated(core), false);
});

test('el costo de venta (COGS) es informativo y no reduce la ganancia neta', () => {
  const rows: DaySubsetRows = {
    sessions: [],
    payments: [payment('cash', 1000)],
    cogsRows: [cogs(300)],
    expenses: [expense('transfer', 200)],
    purchases: [],
  };

  const core = computeDayCore(rows, DEFAULT_PERCENTAGES);

  assert.equal(core.totalCogs.toNumber(), 300);
  assert.equal(core.grossProfit.toNumber(), 700); // 1000 - 300, informational only (not used below)
  assert.equal(core.netProfit.toNumber(), 800); // 1000 - 200, COGS is not subtracted
});

test('el gasto operativo fijo se resta de la ganancia neta antes de calcular la distribución (gananciaDistribuible)', () => {
  const rows: DaySubsetRows = {
    sessions: [],
    payments: [payment('cash', 1000)],
    cogsRows: [],
    expenses: [expense('transfer', 200)],
    purchases: [],
  };

  const core = computeDayCore(rows, DEFAULT_PERCENTAGES, money(260));

  assert.equal(core.netProfit.toNumber(), 800); // 1000 - 200
  assert.equal(core.fixedOperatingExpenses.toNumber(), 260);
  assert.equal(core.distributableProfit.toNumber(), 540); // 800 - 260
  // Distribution percentages apply to distributableProfit, not netProfit.
  const distSum = core.savingsAmount.plus(core.businessFundAmount).plus(core.suppliesAmount);
  assert.equal(distSum.toNumber(), core.distributableProfit.toNumber());
});

test('gastos por transferencia/tarjeta reducen la ganancia neta pero nunca el efectivo esperado', () => {
  const rows: DaySubsetRows = {
    sessions: [session({ openingAmount: money(0), expectedAmount: money(1000), closingAmount: money(1000), status: 'closed' })],
    payments: [payment('cash', 1000)],
    cogsRows: [],
    expenses: [expense('transfer', 300)],
    purchases: [],
  };

  const core = computeDayCore(rows, DEFAULT_PERCENTAGES);

  assert.equal(core.totalExpenses.toNumber(), 300);
  assert.equal(core.netProfit.toNumber(), 700);
  // expectedCash comes straight from the session's own running balance, untouched by the transfer expense.
  assert.equal(core.expectedCash?.toNumber(), 1000);
  assert.equal(core.cashDifference?.toNumber(), 0);
  assert.equal(core.cashStatus, 'CUADRADA');
});

test('una sesión aún abierta ese día marca la conciliación como PENDIENTE, nunca inventa un cierre', () => {
  const rows: DaySubsetRows = {
    sessions: [
      session({ id: 's1', expectedAmount: money(500), closingAmount: money(500), status: 'closed' }),
      session({ id: 's2', expectedAmount: money(300), status: 'open' }),
    ],
    payments: [],
    cogsRows: [],
    expenses: [],
    purchases: [],
  };

  const core = computeDayCore(rows, DEFAULT_PERCENTAGES);

  assert.equal(core.sessionsCount, 2);
  assert.equal(core.openSessionsCount, 1);
  assert.equal(core.expectedCash?.toNumber(), 800);
  assert.equal(core.cashStatus, 'PENDIENTE');
  assert.equal(core.actualCash, null);
});

test('sin horario configurado (businessHours=null), todos los gastos cuentan — comportamiento por defecto sin cambios', () => {
  const rows: DaySubsetRows = {
    sessions: [],
    payments: [payment('cash', 1000)],
    cogsRows: [],
    expenses: [
      expense('cash', 100, new Date('2026-06-15T15:00:00.000Z')), // 09:00 America/Mexico_City
      expense('cash', 50, new Date('2026-06-16T05:00:00.000Z')), // 23:00 America/Mexico_City (would be "outside hours")
    ],
    purchases: [],
  };

  const core = computeDayCore(rows, DEFAULT_PERCENTAGES);

  assert.equal(core.totalExpenses.toNumber(), 150);
});

test('con horario configurado, solo los gastos registrados dentro del horario de servicio cuentan en Gastos Variables', () => {
  const rows: DaySubsetRows = {
    sessions: [],
    payments: [payment('cash', 1000)],
    cogsRows: [],
    expenses: [
      expense('cash', 100, new Date('2026-06-15T15:00:00.000Z')), // 09:00 local -> dentro (09:00-22:00)
      expense('cash', 50, new Date('2026-06-16T05:00:00.000Z')), // 23:00 local -> fuera de horario
    ],
    purchases: [],
  };

  const core = computeDayCore(rows, DEFAULT_PERCENTAGES, money(0), BUSINESS_HOURS);

  assert.equal(core.totalExpenses.toNumber(), 100);
  assert.equal(core.netProfit.toNumber(), 900); // 1000 - 100 (the out-of-hours expense is excluded)
});
