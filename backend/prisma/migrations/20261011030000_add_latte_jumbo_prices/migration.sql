ALTER TABLE "products"
  ADD COLUMN "jumboPrice" DECIMAL(12, 2);

UPDATE "products"
SET "jumboPrice" = CASE
  WHEN "sku" = 'BEV-006' THEN 110.00
  ELSE 98.00
END
WHERE "sku" IN ('BEV-002', 'BEV-003', 'BEV-004', 'BEV-005', 'BEV-006', 'BEV-007', 'BEV-015', 'BEV-016', 'ESP-02');