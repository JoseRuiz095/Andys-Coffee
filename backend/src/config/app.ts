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

// Express 'trust proxy' setting. Leave unset when the API is reached directly; set it to the
// number of reverse proxies in front of the API (e.g. TRUST_PROXY=1) so req.ip is the real
// client IP. Never trust X-Forwarded-For blindly: clients can forge it.
const trustProxyEnv = process.env.TRUST_PROXY?.trim();
export const TRUST_PROXY: boolean | number | string = !trustProxyEnv
  ? false
  : /^\d+$/.test(trustProxyEnv)
    ? Number(trustProxyEnv)
    : trustProxyEnv;

// Store timezone used to decide when the business day ends for automatic cash-session
// closing (see cash.service.ts).
export const CASH_TIMEZONE = process.env.CASH_TIMEZONE || 'America/Mexico_City';

// closingReason of cash cuts closed by the end-of-day job instead of a real count. Reports
// treat those cuts as "SIN_CONTEO" until someone corrects them with the counted cash.
export const AUTO_CLOSE_REASON = 'Cierre automático sin conteo';
