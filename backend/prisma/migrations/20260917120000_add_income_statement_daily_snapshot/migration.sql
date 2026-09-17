-- CreateTable
CREATE TABLE "income_statement_daily_snapshots" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "date" DATE NOT NULL,
    "hadOperation" BOOLEAN NOT NULL DEFAULT false,
    "openingFund" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transferRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCogs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalExpenses" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netProfit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedCash" DECIMAL(12,2),
    "actualCash" DECIMAL(12,2),
    "cashDifference" DECIMAL(12,2),
    "cashStatus" TEXT,
    "savingsAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "businessFundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "suppliesAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "savingsAccumulated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "businessFundAccumulated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "suppliesAccumulated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "savingsPercentUsed" DECIMAL(5,2) NOT NULL,
    "businessFundPercentUsed" DECIMAL(5,2) NOT NULL,
    "suppliesPercentUsed" DECIMAL(5,2) NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_statement_daily_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "income_statement_daily_snapshots_date_key" ON "income_statement_daily_snapshots"("date");

-- CreateIndex
CREATE INDEX "income_statement_daily_snapshots_isFinal_date_idx" ON "income_statement_daily_snapshots"("isFinal", "date");
