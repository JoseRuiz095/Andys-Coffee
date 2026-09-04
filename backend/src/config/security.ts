import { logger } from '../utils/logger';

const secret = process.env.JWT_SECRET;
const minLength = 32;

if (!secret) {
  logger.error("FATAL: JWT_SECRET is not defined in the environment variables.");
  throw new Error("JWT_SECRET must be defined.");
}

if (secret.length < minLength) {
  logger.error(
    `FATAL: JWT_SECRET is too short. It must be at least ${minLength} characters long.`
  );
  throw new Error(
    `JWT_SECRET is too short. Minimum length is ${minLength} characters.`
  );
}

const uniqueCharacters = new Set(secret).size;
if (uniqueCharacters < 16 || /^(.)(\1)+$/.test(secret)) {
  logger.error("FATAL: JWT_SECRET does not have enough entropy.");
  throw new Error("JWT_SECRET must contain at least 16 distinct characters.");
}

if (secret === "replace-me-with-a-long-random-string") {
    logger.error("FATAL: The default JWT_SECRET is being used. This is insecure.");
    throw new Error("Do not use the default JWT_SECRET in a production environment.");
}

export const JWT_SECRET = secret;

logger.info("JWT secret loaded successfully.");
