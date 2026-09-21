-- Remove unused models: Ticket, PurchaseInvoiceCounter, PromotionOnProduct, PromotionOnCategory
-- These models were in the schema but had zero usage in the codebase

-- Drop foreign key constraints first
ALTER TABLE "public"."PromotionOnCategory" DROP CONSTRAINT IF EXISTS "PromotionOnCategory_promotionId_fkey";
ALTER TABLE "public"."PromotionOnCategory" DROP CONSTRAINT IF EXISTS "PromotionOnCategory_categoryId_fkey";
ALTER TABLE "public"."PromotionOnProduct" DROP CONSTRAINT IF EXISTS "PromotionOnProduct_promotionId_fkey";
ALTER TABLE "public"."PromotionOnProduct" DROP CONSTRAINT IF EXISTS "PromotionOnProduct_productId_fkey";

-- Drop tables
DROP TABLE IF EXISTS "public"."PromotionOnCategory";
DROP TABLE IF EXISTS "public"."PromotionOnProduct";
DROP TABLE IF EXISTS "public"."tickets";
DROP TABLE IF EXISTS "public"."purchase_invoice_counters";
