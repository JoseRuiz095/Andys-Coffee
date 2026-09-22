import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addCalendarDays,
  getZonedDayBoundaries,
  getZonedCalendarDate,
  getWeekRange,
  getMonthRange,
  getZonedInstant,
  getBusinessMidpointInstant,
  getZonedTimeOfDay,
} from '../src/utils/businessDate';

const TZ = 'America/Mexico_City'; // UTC-6 (no DST in Mexico as of 2022+)

test('addCalendarDays adds/subtracts pure calendar days, independent of timezone', () => {
  assert.equal(addCalendarDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addCalendarDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addCalendarDays('2026-12-31', 1), '2027-01-01');
});

test('getZonedDayBoundaries returns the UTC instants for local midnight in the given timezone', () => {
  const { start, end } = getZonedDayBoundaries('2026-06-15', TZ);
  // Mexico_City is UTC-6: local 00:00 on 2026-06-15 is 06:00 UTC the same day.
  assert.equal(start.toISOString(), '2026-06-15T06:00:00.000Z');
  assert.equal(end.toISOString(), '2026-06-16T06:00:00.000Z');
});

test('getZonedCalendarDate maps a UTC instant back to the correct local calendar day', () => {
  // 2026-06-16T05:59:59Z is still 2026-06-15 23:59:59 local (UTC-6).
  assert.equal(getZonedCalendarDate(new Date('2026-06-16T05:59:59.000Z'), TZ), '2026-06-15');
  assert.equal(getZonedCalendarDate(new Date('2026-06-16T06:00:00.000Z'), TZ), '2026-06-16');
});

test('getWeekRange returns a Monday-Sunday week containing the given date', () => {
  // 2026-06-17 is a Wednesday.
  const { weekStart, weekEnd, days } = getWeekRange('2026-06-17', TZ);
  assert.equal(weekStart, '2026-06-15'); // Monday
  assert.equal(weekEnd, '2026-06-21'); // Sunday
  assert.deepEqual(days, ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21']);
});

test('getWeekRange handles a date that already is a Monday', () => {
  const { weekStart, weekEnd } = getWeekRange('2026-06-15', TZ);
  assert.equal(weekStart, '2026-06-15');
  assert.equal(weekEnd, '2026-06-21');
});

test('getMonthRange returns every calendar date in the month, including short/leap Februaries', () => {
  const feb2028 = getMonthRange('2028-02', TZ); // leap year
  assert.equal(feb2028.monthStart, '2028-02-01');
  assert.equal(feb2028.monthEnd, '2028-02-29');
  assert.equal(feb2028.days.length, 29);

  const feb2026 = getMonthRange('2026-02', TZ); // non-leap year
  assert.equal(feb2026.monthEnd, '2026-02-28');
  assert.equal(feb2026.days.length, 28);
});

// --- C-01: back-dated expenses must land inside business hours ---

test('getZonedInstant converts a local wall-clock time to the matching UTC instant', () => {
  assert.equal(getZonedInstant('2026-09-10', 15 * 60 + 30, TZ).toISOString(), '2026-09-10T21:30:00.000Z');
  assert.equal(getZonedInstant('2026-09-10', 0, TZ).toISOString(), '2026-09-10T06:00:00.000Z');
});

test('getBusinessMidpointInstant places the record mid business day, on the same local date', () => {
  const instant = getBusinessMidpointInstant('2026-09-10', '09:00', '22:00', TZ);
  assert.equal(instant.toISOString(), '2026-09-10T21:30:00.000Z'); // 15:30 local
  assert.equal(getZonedCalendarDate(instant, TZ), '2026-09-10');
  // Regression: the old code stored 12:00Z = 06:00 local, before opening, and the income
  // statement silently dropped the expense.
  const { hour } = getZonedTimeOfDay(instant, TZ);
  assert.ok(hour >= 9 && hour < 22, `hour ${hour} must be inside business hours`);
});

test('getBusinessMidpointInstant falls back to local noon for an invalid range', () => {
  assert.equal(getBusinessMidpointInstant('2026-09-10', '22:00', '09:00', TZ).toISOString(), '2026-09-10T18:00:00.000Z');
});
