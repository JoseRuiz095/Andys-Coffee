-- Add index on createdAt for recent inventory movements queries
CREATE INDEX "inventoryMovements_createdAt_idx" ON "inventory_movements"("createdAt" DESC);
