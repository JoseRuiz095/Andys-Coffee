import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addCalendarDays,
  getZonedDayBoundaries,
  getZonedCalendarDate,
  getWeekRange,
  getMonthRange,
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
