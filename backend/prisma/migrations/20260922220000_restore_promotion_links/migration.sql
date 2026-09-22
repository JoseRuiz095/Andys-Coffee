-- N-01 (docs/auditoria-mvp-2026-09-22.md): restore which products/categories each promotion
-- applies to. 20260921120000_remove_unused_models dropped these tables as "unused", which made
-- every active promotion apply to every product. Links now cascade on delete so they never
-- block deleting a product, category or promotion.

CREATE TABLE "PromotionOnProduct" (
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    CONSTRAINT "PromotionOnProduct_pkey" PRIMARY KEY ("promotionId","productId")
);

CREATE TABLE "PromotionOnCategory" (
    "promotionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "PromotionOnCategory_pkey" PRIMARY KEY ("promotionId","categoryId")
);

CREATE INDEX "PromotionOnProduct_productId_idx" ON "PromotionOnProduct"("productId");
CREATE INDEX "PromotionOnCategory_categoryId_idx" ON "PromotionOnCategory"("categoryId");

ALTER TABLE "PromotionOnProduct" ADD CONSTRAINT "PromotionOnProduct_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionOnProduct" ADD CONSTRAINT "PromotionOnProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionOnCategory" ADD CONSTRAINT "PromotionOnCategory_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionOnCategory" ADD CONSTRAINT "PromotionOnCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data restore from backend/prisma/backups/2026-09-22-remove_unused_models.json.
-- Only rows whose promotion/product/category still exist are inserted, so this is a no-op on
-- databases with other ids (fresh/test databases get their links from prisma/seed.ts).
INSERT INTO "PromotionOnProduct" ("promotionId", "productId")
SELECT v."promotionId", v."productId"
FROM (VALUES
  ('bf190b1e-9f60-484b-b28e-76879201a978', '4075bc66-a61a-4dec-93ea-996a766f5974'),
  ('bf190b1e-9f60-484b-b28e-76879201a978', '2a6a7806-dabd-49bc-9cbd-57d761420425'),
  ('a620fd4a-5412-4aef-a18d-58b4ae22a0f0', '14001551-a0c9-4df0-8fd0-bf0eb4322526'),
  ('a620fd4a-5412-4aef-a18d-58b4ae22a0f0', '7fc01ecb-5185-4026-b3ac-d331ab458772'),
  ('a620fd4a-5412-4aef-a18d-58b4ae22a0f0', 'a79ce020-b144-4dfd-92ce-9d342bdcb635'),
  ('a620fd4a-5412-4aef-a18d-58b4ae22a0f0', '06260535-8dcc-4aac-af2b-0bd2dcddeb03'),
  ('a620fd4a-5412-4aef-a18d-58b4ae22a0f0', '58691996-f140-47ea-8ab3-ea9a88eac883'),
  ('a620fd4a-5412-4aef-a18d-58b4ae22a0f0', 'cac55fb7-5ef2-453d-8b35-3c880daa2221'),
  ('a620fd4a-5412-4aef-a18d-58b4ae22a0f0', '742f17d2-01aa-4abc-be1a-7b78fb2e3ad5'),
  ('a620fd4a-5412-4aef-a18d-58b4ae22a0f0', '6b96097a-e917-4ff1-b62a-5197d9f3c588')
) AS v("promotionId", "productId")
WHERE EXISTS (SELECT 1 FROM "promotions" p WHERE p."id" = v."promotionId")
  AND EXISTS (SELECT 1 FROM "products" pr WHERE pr."id" = v."productId");

INSERT INTO "PromotionOnCategory" ("promotionId", "categoryId")
SELECT v."promotionId", v."categoryId"
FROM (VALUES
  ('d47f9e14-b501-4d13-90ce-cff565705dd3', '24c2381c-ae44-40a4-bb41-ce2e03cdfdca')
) AS v("promotionId", "categoryId")
WHERE EXISTS (SELECT 1 FROM "promotions" p WHERE p."id" = v."promotionId")
  AND EXISTS (SELECT 1 FROM "categories" c WHERE c."id" = v."categoryId");
