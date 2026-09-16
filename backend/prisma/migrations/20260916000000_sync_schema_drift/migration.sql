-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_cashSessionId_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey";

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "system_preferences" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "label" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_preferences_key_key" ON "system_preferences"("key");

-- CreateIndex
CREATE INDEX "cashSessions_register_history_idx" ON "cash_sessions"("cashRegisterId", "openedAt" DESC);

-- "ingredients_sku_unique" already exists as a partial unique index (WHERE sku IS NOT NULL),
-- created out-of-band from a previous raw-SQL migration; functionally equivalent to what
-- Prisma's @unique would create for a nullable column (Postgres unique indexes already allow
-- multiple NULLs), so it is intentionally not recreated here.

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
