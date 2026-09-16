import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP/email to 5 login attempts per windowMs
  message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Rate limit by IP + email for better granularity
    const email = req.body?.email || '';
    const ip = req.ip || '';
    return `${ip}-${email}`;
  },
  skip: (req) => {
    // Skip rate limiting for non-login requests
    return req.method !== 'POST' || !req.path.includes('/login');
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.',
      statusCode: 429,
    });
  },
});

export const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each user to 3 password change attempts per windowMs
  message: 'Demasiados intentos de cambio de contraseña. Intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID from authenticated session
    return (req as any).user?.id || req.ip || '';
  },
  skip: (req) => {
    // Skip if not authenticated or not a password change request
    if (!req.method.includes('POST')) return true;
    if (!req.path.includes('/change-password')) return true;
    if (!(req as any).user?.id) return true; // Only rate limit authenticated requests
    return false;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos de cambio de contraseña. Intenta de nuevo más tarde.',
      statusCode: 429,
    });
  },
});
