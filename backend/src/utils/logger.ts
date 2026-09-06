import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
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
