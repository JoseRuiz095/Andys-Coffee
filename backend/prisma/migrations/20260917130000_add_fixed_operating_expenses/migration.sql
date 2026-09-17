-- AlterTable
ALTER TABLE "income_statement_daily_snapshots" ADD COLUMN "fixedExpensesAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "fixedExpenseRateUsed" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "sessionsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "openSessionsCount" INTEGER NOT NULL DEFAULT 0;
