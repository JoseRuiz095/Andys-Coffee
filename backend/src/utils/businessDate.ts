import { CASH_TIMEZONE } from '../config/app';

/**
 * Timezone-aware date helpers for financial reporting.
 *
 * Centralizes calendar-day math against CASH_TIMEZONE so day/week/month
 * boundaries are consistent with the cash-session auto-close logic
 * (cash.service.ts), instead of the server's local timezone.
 */

function splitDateString(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

function formatDateParts(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/** Pure calendar-date arithmetic (no timezone conversion involved). */
export function addCalendarDays(dateStr: string, amount: number): string {
  const { year, month, day } = splitDateString(dateStr);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + amount);
  return formatDateParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** ISO weekday for a calendar date: 1 = Monday ... 7 = Sunday. */
function isoWeekday(dateStr: string): number {
  const { year, month, day } = splitDateString(dateStr);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

/**
 * Converts a local calendar date + time (in `timeZone`) to the UTC instant
 * it represents, using a format-then-diff pass. Correct for all practical
 * report-boundary purposes; does not special-case the rare instant exactly
 * inside a DST transition.
 */
function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const guessMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const guess = new Date(guessMs);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(guess);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }

  const asIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    map.hour === '24' ? 0 : Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );

  const offset = asIfUtc - guessMs;
  return new Date(guessMs - offset);
}

/** UTC instants for local 00:00:00 (inclusive) to next-day 00:00:00 (exclusive) of `dateStr` in `timeZone`. */
export function getZonedDayBoundaries(
  dateStr: string,
  timeZone: string = CASH_TIMEZONE,
): { start: Date; end: Date } {
  const { year, month, day } = splitDateString(dateStr);
  const start = zonedWallTimeToUtc(year, month, day, 0, 0, 0, timeZone);
  const nextDay = splitDateString(addCalendarDays(dateStr, 1));
  const end = zonedWallTimeToUtc(nextDay.year, nextDay.month, nextDay.day, 0, 0, 0, timeZone);
  return { start, end };
}

/** UTC instant for the wall-clock time `minutesOfDay` (0-1439) on `dateStr` in `timeZone`. */
export function getZonedInstant(
  dateStr: string,
  minutesOfDay: number,
  timeZone: string = CASH_TIMEZONE,
): Date {
  const { year, month, day } = splitDateString(dateStr);
  return zonedWallTimeToUtc(year, month, day, Math.floor(minutesOfDay / 60), minutesOfDay % 60, 0, timeZone);
}

function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + (minute || 0);
}

/**
 * Instant in the middle of the business day `dateStr` (open/close as "HH:MM" in
 * `timeZone`). Used for records dated by calendar day only (e.g. a back-dated expense)
 * so they fall inside business hours, where the income statement counts them.
 * Falls back to local noon if the configured hours are not a valid same-day range.
 */
export function getBusinessMidpointInstant(
  dateStr: string,
  businessHoursOpen: string,
  businessHoursClose: string,
  timeZone: string = CASH_TIMEZONE,
): Date {
  const open = timeToMinutes(businessHoursOpen);
  const close = timeToMinutes(businessHoursClose);
  const midpoint = close > open ? Math.floor((open + close) / 2) : 12 * 60;
  return getZonedInstant(dateStr, midpoint, timeZone);
}

/** Calendar date (YYYY-MM-DD) that `instant` falls on, in `timeZone`. */
export function getZonedCalendarDate(instant: Date, timeZone: string = CASH_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function getTodayInZone(timeZone: string = CASH_TIMEZONE): string {
  return getZonedCalendarDate(new Date(), timeZone);
}

/**
 * A business calendar date as stored in date-only columns (e.g. Promotion.startDate/endDate,
 * saved as 'YYYY-MM-DD 00:00'): UTC midnight of `dateStr`, plus its weekday (0 = Sunday).
 * Independent of the server's timezone, unlike `new Date('YYYY-MM-DD 00:00:00')`.
 */
export function getCalendarDateAsUtc(dateStr: string): { date: Date; weekday: number } {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  return { date, weekday: date.getUTCDay() };
}

/** Wall-clock hour/minute that `instant` falls on, in `timeZone` — for comparing against business hours. */
export function getZonedTimeOfDay(instant: Date, timeZone: string = CASH_TIMEZONE): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }

  return { hour: map.hour === '24' ? 0 : Number(map.hour), minute: Number(map.minute) };
}

/** Monday-Sunday week containing `dateStr`. */
export function getWeekRange(
  dateStr: string,
  timeZone: string = CASH_TIMEZONE,
): { weekStart: string; weekEnd: string; days: string[] } {
  void timeZone; // calendar-date math only; timeZone kept for signature symmetry/future use
  const weekday = isoWeekday(dateStr);
  const weekStart = addCalendarDays(dateStr, -(weekday - 1));
  const days = Array.from({ length: 7 }, (_, i) => addCalendarDays(weekStart, i));
  return { weekStart, weekEnd: days[6], days };
}

/** All calendar dates in the given YYYY-MM month. */
export function getMonthRange(
  yearMonth: string,
  timeZone: string = CASH_TIMEZONE,
): { monthStart: string; monthEnd: string; days: string[] } {
  void timeZone;
  const [year, month] = yearMonth.split('-').map(Number);
  const monthStart = formatDateParts(year, month, 1);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => formatDateParts(year, month, i + 1));
  return { monthStart, monthEnd: days[days.length - 1], days };
}
