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
