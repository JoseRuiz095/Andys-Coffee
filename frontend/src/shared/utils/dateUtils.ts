/**
 * Get today's date in the business timezone (America/Mexico_City)
 * Returns string in format YYYY-MM-DD
 *
 * Uses Intl.DateTimeFormat to calculate the date in the local timezone,
 * avoiding the UTC normalization issue of toISOString()
 */
export function getTodayDateString(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Mexico_City',
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

/**
 * Get current year-month in the business timezone
 * Returns string in format YYYY-MM
 */
export function getCurrentYearMonth(): string {
  const dateStr = getTodayDateString();
  return dateStr.slice(0, 7); // YYYY-MM
}

const DISPLAY_LOCALE = 'es-MX'

/** "13/11/26, 10:30": schedules, cancellation requests, order cards. */
export function formatShortDateTime(value: string | Date): string {
  return new Date(value).toLocaleString(DISPLAY_LOCALE, { dateStyle: 'short', timeStyle: 'short' })
}

/** "13 nov 2026, 10:30": pending payments, deliveries and order details. */
export function formatDayAndTime(value: string | Date): string {
  return new Date(value).toLocaleDateString(DISPLAY_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "13 nov 2026": creation dates and other day-only values. */
export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(DISPLAY_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' })
}
