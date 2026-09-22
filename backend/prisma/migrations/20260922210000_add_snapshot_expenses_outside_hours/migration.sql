-- R-03 (docs/auditoria-mvp-2026-09-22.md): every expense/purchase of the day now counts in
-- the income statement; this column keeps, for information, how much of it was registered
-- outside business hours. Existing snapshots had no out-of-hours expenses (verified in
-- production before this migration), so 0 is correct for them.
ALTER TABLE "income_statement_daily_snapshots" ADD COLUMN "expensesOutsideHours" DECIMAL(12,2) NOT NULL DEFAULT 0;
