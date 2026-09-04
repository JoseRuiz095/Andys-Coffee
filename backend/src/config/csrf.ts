import { logger } from '../utils/logger';

const secret = process.env.CSRF_SECRET;
const requiredLength = 32;

if (!secret) {
  logger.error("FATAL: CSRF_SECRET is not defined in the environment variables.");
  throw new Error("CSRF_SECRET must be defined.");
}

if (secret.length !== requiredLength) {
  logger.error(
    `FATAL: CSRF_SECRET must be exactly ${requiredLength} characters long.`
  );
  throw new Error(
    `CSRF_SECRET must be exactly ${requiredLength} characters long.`
  );
}

export const CSRF_SECRET = secret;

logger.info("CSRF secret loaded successfully.");
