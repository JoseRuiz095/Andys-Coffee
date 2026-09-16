-- CreateTable
CREATE TABLE "inventory_counts" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "countedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "completedById" TEXT,
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_count_items" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "inventoryCountId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "systemQuantity" DECIMAL(14,4) NOT NULL,
    "countedQuantity" DECIMAL(14,4) NOT NULL,
    "difference" DECIMAL(14,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_counts_status_idx" ON "inventory_counts"("status");

-- CreateIndex
CREATE INDEX "inventory_counts_countedAt_idx" ON "inventory_counts"("countedAt" DESC);

-- CreateIndex
CREATE INDEX "inventory_counts_createdById_idx" ON "inventory_counts"("createdById");

-- CreateIndex
CREATE INDEX "inventory_count_items_inventoryCountId_idx" ON "inventory_count_items"("inventoryCountId");

-- CreateIndex
CREATE UNIQUE INDEX "inventoryCountItems_unique" ON "inventory_count_items"("inventoryCountId", "ingredientId");

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "inventory_counts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
