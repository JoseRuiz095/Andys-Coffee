/*
  Warnings:

  - You are about to drop the column `discountType` on the `promotions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `combos` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENTAGE', 'FIXED_DISCOUNT', 'FIXED_PRICE', 'BOGO', 'MULTIBUY_FIXED_PRICE');

-- AlterTable
ALTER TABLE "combos" ADD COLUMN     "activeOnDays" INTEGER[];

-- AlterTable
ALTER TABLE "promotions" DROP COLUMN "discountType",
ADD COLUMN     "activeOnDays" INTEGER[],
ADD COLUMN     "buyQuantity" INTEGER,
ADD COLUMN     "getQuantity" INTEGER,
ADD COLUMN     "type" "PromotionType" NOT NULL DEFAULT 'PERCENTAGE';

-- CreateTable
CREATE TABLE "PromotionOnProduct" (
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "PromotionOnProduct_pkey" PRIMARY KEY ("promotionId","productId")
);

-- CreateTable
CREATE TABLE "PromotionOnCategory" (
    "promotionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "PromotionOnCategory_pkey" PRIMARY KEY ("promotionId","categoryId")
);

-- CreateIndex
CREATE UNIQUE INDEX "combos_name_key" ON "combos"("name");

-- AddForeignKey
ALTER TABLE "PromotionOnProduct" ADD CONSTRAINT "PromotionOnProduct_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionOnProduct" ADD CONSTRAINT "PromotionOnProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionOnCategory" ADD CONSTRAINT "PromotionOnCategory_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionOnCategory" ADD CONSTRAINT "PromotionOnCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
