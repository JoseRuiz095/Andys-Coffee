import { apiClient } from '../../../app/api';

const BASE_URL = '/income-statement';

export type CashStatus = 'CUADRADA' | 'SOBRANTE' | 'FALTANTE' | 'PENDIENTE' | null;

export interface DayFinancialSummary {
  date: string;
  hadOperation: boolean;
  movimientos: {
    ingresosEfectivo: number;
    ingresosTransferencia: number;
    ingresosOtros: number;
    ingresosTotales: number;
    costoVenta: number;
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
    gastosOperativosFijos: number;
    gananciaDistribuible: number;
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
    openedAt: string;
    closedAt: string | null;
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
    expenseDate: string;
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
  gastos: number;
  gananciaNeta: number;
  gastosOperativosFijos: number;
  gananciaDistribuible: number;
  ahorro: number;
  fondoNegocio: number;
  surtido: number;
  lastAccumulated: { ahorroAcumulado: number; fondoNegocioAcumulado: number; surtidoAcumulado: number };
}

export interface FixedExpenseConcept {
  slug: string;
  label: string;
  amount: number;
}

export interface FixedExpenseSettings {
  concepts: FixedExpenseConcept[];
  total: number;
}

export interface WeekFinancialResponse {
  weekStart: string;
  weekEnd: string;
  days: DayFinancialSummary[];
  totals: PeriodTotals;
}

export interface MonthFinancialResponse {
  month: string;
  monthStart: string;
  monthEnd: string;
  days: DayFinancialSummary[];
  totals: PeriodTotals;
}

export interface RangeFinancialResponse {
  from: string;
  to: string;
  days: DayFinancialSummary[];
  totals: PeriodTotals;
}

export interface DistributionSettings {
  savingsPercent: number;
  businessFundPercent: number;
  suppliesPercent: number;
}

export const IncomeStatementAPI = {
  async getDay(params: { date: string; cashRegisterId?: string }) {
    const queryParams = new URLSearchParams({ date: params.date });
    if (params.cashRegisterId) queryParams.set('cashRegisterId', params.cashRegisterId);
    const { data } = await apiClient.get<DayFinancialSummary>(`${BASE_URL}/day?${queryParams.toString()}`);
    return data;
  },

  async getDayDetail(params: { date: string; cashRegisterId?: string }) {
    const queryParams = new URLSearchParams({ date: params.date });
    if (params.cashRegisterId) queryParams.set('cashRegisterId', params.cashRegisterId);
    const { data } = await apiClient.get<DayDetailResponse>(`${BASE_URL}/day-detail?${queryParams.toString()}`);
    return data;
  },

  async getWeek(params: { date: string; cashRegisterId?: string }) {
    const queryParams = new URLSearchParams({ date: params.date });
    if (params.cashRegisterId) queryParams.set('cashRegisterId', params.cashRegisterId);
    const { data } = await apiClient.get<WeekFinancialResponse>(`${BASE_URL}/week?${queryParams.toString()}`);
    return data;
  },

  async getMonth(params: { month: string; cashRegisterId?: string }) {
    const queryParams = new URLSearchParams({ month: params.month });
    if (params.cashRegisterId) queryParams.set('cashRegisterId', params.cashRegisterId);
    const { data } = await apiClient.get<MonthFinancialResponse>(`${BASE_URL}/month?${queryParams.toString()}`);
    return data;
  },

  async getRange(params: { from: string; to: string; cashRegisterId?: string }) {
    const queryParams = new URLSearchParams({ from: params.from, to: params.to });
    if (params.cashRegisterId) queryParams.set('cashRegisterId', params.cashRegisterId);
    const { data } = await apiClient.get<RangeFinancialResponse>(`${BASE_URL}/range?${queryParams.toString()}`);
    return data;
  },

  async getDistributionSettings() {
    const { data } = await apiClient.get<DistributionSettings>(`${BASE_URL}/settings/distribution`);
    return data;
  },

  async updateDistributionSettings(input: DistributionSettings) {
    const { data } = await apiClient.patch<DistributionSettings>(`${BASE_URL}/settings/distribution`, input);
    return data;
  },

  async getFixedExpenseSettings() {
    const { data } = await apiClient.get<FixedExpenseSettings>(`${BASE_URL}/settings/fixed-expenses`);
    return data;
  },

  async upsertFixedExpenseConcept(slug: string, input: { label: string; amount: number }) {
    const { data } = await apiClient.put<FixedExpenseSettings>(`${BASE_URL}/settings/fixed-expenses/${slug}`, input);
    return data;
  },

  async deleteFixedExpenseConcept(slug: string) {
    const { data } = await apiClient.delete<FixedExpenseSettings>(`${BASE_URL}/settings/fixed-expenses/${slug}`);
    return data;
  },

  async updateAccumulatedBalances(
    date: string,
    input: { ahorroAcumulado: number; fondoNegocioAcumulado: number; surtidoAcumulado: number },
  ) {
    const queryParams = new URLSearchParams({ date });
    const { data } = await apiClient.patch<DayFinancialSummary>(
      `${BASE_URL}/day/accumulated-balances?${queryParams.toString()}`,
      input,
    );
    return data;
  },
};
