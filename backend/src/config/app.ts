export const NODE_ENV = process.env.NODE_ENV ?? 'development';
export const isProduction = NODE_ENV === 'production';

export const PORT = Number(process.env.PORT || 4000);

export const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProduction && !process.env.CORS_ORIGINS) {
  throw new Error('CORS_ORIGINS must be configured in production.');
}

// Store timezone used to decide when the business day ends for automatic cash-session
// closing (see cash.service.ts).
export const CASH_TIMEZONE = process.env.CASH_TIMEZONE || 'America/Mexico_City';
