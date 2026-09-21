-- AlterTable
ALTER TABLE "ingredients" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ingredients_active_deleted_idx" ON "ingredients"("isActive", "deletedAt");
