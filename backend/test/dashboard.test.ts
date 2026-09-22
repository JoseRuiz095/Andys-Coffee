import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

// Pin the business timezone before the config module is loaded (dotenv never overrides
// an already-set variable). America/Mexico_City is UTC-6 all year (no DST since 2022),
// so business-day midnight is 06:00Z.
process.env.CASH_TIMEZONE = 'America/Mexico_City';

type DashboardRepositoryModule = typeof import('../src/repositories/dashboard.repository');
type DashboardValidatorModule = typeof import('../src/validators/dashboard.validator');

let getPeriodDateRange: DashboardRepositoryModule['getPeriodDateRange'];
let dashboardSummaryQuerySchema: DashboardValidatorModule['dashboardSummaryQuerySchema'];
let dashboardSalesQuerySchema: DashboardValidatorModule['dashboardSalesQuerySchema'];

before(async () => {
  ({ getPeriodDateRange } = await import('../src/repositories/dashboard.repository'));
  ({ dashboardSummaryQuerySchema, dashboardSalesQuerySchema } = await import('../src/validators/dashboard.validator'));
});

describe('Dashboard Period Range (business timezone)', () => {
  beforeEach(() => {
    // 2026-09-16T12:00Z is Wednesday 2026-09-16 06:00 in Mexico City.
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-16T12:00:00Z') });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('today covers the local calendar day', () => {
    const range = getPeriodDateRange('today');
    assert.equal(range.from.toISOString(), '2026-09-16T06:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-09-17T06:00:00.000Z');
  });

  it('yesterday covers the previous local calendar day', () => {
    const range = getPeriodDateRange('yesterday');
    assert.equal(range.from.toISOString(), '2026-09-15T06:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-09-16T06:00:00.000Z');
  });

  it('week covers Monday to Sunday of the current week', () => {
    const range = getPeriodDateRange('week');
    assert.equal(range.from.toISOString(), '2026-09-14T06:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-09-21T06:00:00.000Z');
  });

  it('month covers the whole current month', () => {
    const range = getPeriodDateRange('month');
    assert.equal(range.from.toISOString(), '2026-09-01T06:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-10-01T06:00:00.000Z');
  });

  it('customRange includes the whole last day (exclusive end)', () => {
    const range = getPeriodDateRange('customRange', '2026-09-10', '2026-09-15');
    assert.equal(range.from.toISOString(), '2026-09-10T06:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-09-16T06:00:00.000Z');
  });

  it('customRange without dates throws', () => {
    assert.throws(() => getPeriodDateRange('customRange'));
  });
});

describe('Dashboard Validators', () => {
  it('accepts a summary query for today', () => {
    assert.equal(dashboardSummaryQuerySchema.parse({ period: 'today' }).period, 'today');
  });

  it('rejects an invalid period', () => {
    assert.throws(() => dashboardSummaryQuerySchema.parse({ period: 'invalid' }));
  });

  it('requires from/to for customRange', () => {
    assert.throws(() => dashboardSummaryQuerySchema.parse({ period: 'customRange' }));
  });

  it('rejects from > to', () => {
    assert.throws(() => dashboardSummaryQuerySchema.parse({ period: 'customRange', from: '2026-09-15', to: '2026-09-10' }));
  });

  it('accepts a valid sales query', () => {
    const valid = dashboardSalesQuerySchema.parse({ period: 'week', limit: 10 });
    assert.equal(valid.period, 'week');
    assert.equal(valid.limit, 10);
  });

  it('rejects limit > 100', () => {
    assert.throws(() => dashboardSalesQuerySchema.parse({ period: 'today', limit: 150 }));
  });
});
