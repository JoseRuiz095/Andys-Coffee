import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Client IP as resolved by Express. It only honors X-Forwarded-For when 'trust proxy'
 * is configured (see TRUST_PROXY in config/app.ts), so a client can't rotate that header
 * to get a fresh rate-limit bucket on every attempt.
 */
const getClientIp = (req: Request): string => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown');

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP/email to 5 login attempts per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Rate limit by IP + email for better granularity
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return `${getClientIp(req)}-${email}`;
  },
  skip: (req) => {
    // Skip rate limiting for non-login requests
    return req.method !== 'POST' || !req.path.includes('/login');
  },
  handler: (_req, res) => {
    res.status(429).json({ message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.' });
  },
});

export const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each user to 3 password change attempts per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID from authenticated session
    return req.user?.id ?? getClientIp(req);
  },
  skip: (req) => {
    // Skip if not authenticated or not a password change request
    if (req.method !== 'POST') return true;
    if (!req.path.includes('/change-password')) return true;
    if (!req.user?.id) return true; // Only rate limit authenticated requests
    return false;
  },
  handler: (_req, res) => {
    res.status(429).json({ message: 'Demasiados intentos de cambio de contraseña. Intenta de nuevo más tarde.' });
  },
});
