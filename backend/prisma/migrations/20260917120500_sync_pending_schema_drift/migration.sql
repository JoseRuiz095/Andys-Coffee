-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'preparing';
ALTER TYPE "OrderStatus" ADD VALUE 'ready';

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'cash';

-- CreateTable
CREATE TABLE "purchase_invoice_counters" (
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_invoice_counters_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE INDEX "expenses_cashSessionId_idx" ON "expenses"("cashSessionId");

-- NOTE: "ingredients_sku_unique" is intentionally NOT created here — it already
-- exists in this database (created by an earlier raw-SQL migration), Prisma's
-- diff tool just can't detect it due to the way it was declared. See the
-- comment on Ingredient.sku in schema.prisma.
