ALTER TABLE "cash_sessions"
ADD COLUMN "closingReason" TEXT,
ADD COLUMN "closingComment" TEXT;

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "cashSessionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditLogs_cashSession_idx" ON "audit_logs"("cashSessionId", "createdAt");
CREATE INDEX "auditLogs_user_idx" ON "audit_logs"("userId", "createdAt");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_cashSessionId_fkey"
  FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;