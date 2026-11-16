import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  // E2 (2026-11-14): an error object (Axios, Supabase, Prisma) or a request can carry
  // credentials; they never reach the logs.
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "headers.cookie",
      "headers.authorization",
      "*.password",
      "*.passwordHash",
      "*.currentPassword",
      "*.newPassword",
      "*.token",
      "*.accessToken",
      "err.config.headers",
      "err.config.data",
    ],
    censor: "[redactado]",
  },
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});
export type AuditEvent = {
  requestId?: string;
  actor?: { id: string; name?: string; role?: string };
  action: string;
  entity: string;
  entityId?: string;
  previousState?: string;
  newState?: string;
  amount?: string;
  metadata?: Record<string, unknown>;
};

export function auditLog(event: AuditEvent, message: string) {
  logger.info({ audit: true, ...event }, message);
}
