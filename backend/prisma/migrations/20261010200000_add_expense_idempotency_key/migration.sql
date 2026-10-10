ALTER TABLE "expenses" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "expenses_createdBy_idempotencyKey_unique"
ON "expenses" ("createdById", "idempotencyKey");
