ALTER TABLE "orders" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "orders_createdBy_idempotencyKey_unique"
ON "orders" ("createdById", "idempotencyKey");
