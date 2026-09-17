import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getPeriodDateRange } from '../src/repositories/dashboard.repository';

describe('Dashboard Period Range', () => {
  beforeEach(() => {
    // Mock current date as 2026-09-16
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return today range (00:00 to 23:59:59)', () => {
    const range = getPeriodDateRange('today');
    const from = new Date('2026-09-16T00:00:00Z');
    const to = new Date('2026-09-17T00:00:00Z');

    expect(range.from.getTime()).toBe(from.getTime());
    expect(range.to.getTime()).toBe(to.getTime());
  });

  it('should return yesterday range', () => {
    const range = getPeriodDateRange('yesterday');
    const from = new Date('2026-09-15T00:00:00Z');
    const to = new Date('2026-09-16T00:00:00Z');

    expect(range.from.getTime()).toBe(from.getTime());
    expect(range.to.getTime()).toBe(to.getTime());
  });

  it('should return week range (last 7 days)', () => {
    const range = getPeriodDateRange('week');
    const from = new Date('2026-09-09T00:00:00Z');
    const to = new Date('2026-09-17T00:00:00Z');

    expect(range.from.getTime()).toBe(from.getTime());
    expect(range.to.getTime()).toBe(to.getTime());
  });

  it('should return month range', () => {
    const range = getPeriodDateRange('month');
    const from = new Date('2026-09-01T00:00:00Z');
    const to = new Date('2026-10-01T00:00:00Z');

    expect(range.from.getTime()).toBe(from.getTime());
    expect(range.to.getTime()).toBe(to.getTime());
  });

  it('should return custom range when provided', () => {
    const range = getPeriodDateRange('customRange', '2026-09-10', '2026-09-15');
    const from = new Date('2026-09-10T00:00:00Z');
    const to = new Date('2026-09-15T23:59:59.999Z');

    expect(range.from.getTime()).toBe(from.getTime());
    expect(range.to.getTime()).toBe(to.getTime());
  });

  it('should throw error if customRange without dates', () => {
    expect(() => {
      getPeriodDateRange('customRange');
    }).toThrow();
  });
});

describe('Dashboard Validators', () => {
  it('should validate dashboard summary query schema', async () => {
    const { dashboardSummaryQuerySchema } = await import('../src/validators/dashboard.validator');

    const valid = dashboardSummaryQuerySchema.parse({
      period: 'today',
    });

    expect(valid.period).toBe('today');
  });

  it('should reject invalid period', async () => {
    const { dashboardSummaryQuerySchema } = await import('../src/validators/dashboard.validator');

    expect(() => {
      dashboardSummaryQuerySchema.parse({
        period: 'invalid',
      });
    }).toThrow();
  });

  it('should require from/to for customRange', async () => {
    const { dashboardSummaryQuerySchema } = await import('../src/validators/dashboard.validator');

    expect(() => {
      dashboardSummaryQuerySchema.parse({
        period: 'customRange',
      });
    }).toThrow();
  });

  it('should reject from > to', async () => {
    const { dashboardSummaryQuerySchema } = await import('../src/validators/dashboard.validator');

    expect(() => {
      dashboardSummaryQuerySchema.parse({
        period: 'customRange',
        from: '2026-09-15',
        to: '2026-09-10',
      });
    }).toThrow();
  });

  it('should accept valid sales query', async () => {
    const { dashboardSalesQuerySchema } = await import('../src/validators/dashboard.validator');

    const valid = dashboardSalesQuerySchema.parse({
      period: 'week',
      limit: 10,
    });

    expect(valid.period).toBe('week');
    expect(valid.limit).toBe(10);
  });

  it('should reject limit > 100', async () => {
    const { dashboardSalesQuerySchema } = await import('../src/validators/dashboard.validator');

    expect(() => {
      dashboardSalesQuerySchema.parse({
        period: 'today',
        limit: 150,
      });
    }).toThrow();
  });
});
