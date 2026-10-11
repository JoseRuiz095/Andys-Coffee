ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "scheduleNotifiedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "orders_scheduledFor_idx"
ON "orders" ("scheduledFor");
