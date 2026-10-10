ALTER TABLE "inventory_movements" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "purchases" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "inventory_counts" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "inventoryMovements_createdBy_idempotencyKey_unique"
ON "inventory_movements" ("createdById", "idempotencyKey");

CREATE UNIQUE INDEX "purchases_createdBy_idempotencyKey_unique"
ON "purchases" ("createdById", "idempotencyKey");

CREATE UNIQUE INDEX "inventoryCounts_createdBy_idempotencyKey_unique"
ON "inventory_counts" ("createdById", "idempotencyKey");
