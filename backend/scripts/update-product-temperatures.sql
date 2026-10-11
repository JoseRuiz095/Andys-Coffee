-- Catalog data patch: reviewed for development and reusable for production after approval.
-- Updates only temperature values for matching product SKUs.
BEGIN;

UPDATE public.products AS product
SET "temperature" = updates.temperature
FROM (VALUES
  ('BEV-001', 'BOTH'::"DrinkTemperature"),
  ('BEV-002', 'BOTH'::"DrinkTemperature"),
  ('BEV-003', 'BOTH'::"DrinkTemperature"),
  ('BEV-004', 'BOTH'::"DrinkTemperature"),
  ('BEV-005', 'BOTH'::"DrinkTemperature"),
  ('BEV-006', 'BOTH'::"DrinkTemperature"),
  ('BEV-007', 'BOTH'::"DrinkTemperature"),
  ('BEV-008', 'BOTH'::"DrinkTemperature"),
  ('BEV-009', 'BOTH'::"DrinkTemperature"),
  ('BEV-010', 'BOTH'::"DrinkTemperature"),
  ('BEV-011', 'COLD'::"DrinkTemperature"),
  ('BEV-015', 'COLD'::"DrinkTemperature"),
  ('BEV-016', 'COLD'::"DrinkTemperature"),
  ('BEV-018', 'COLD'::"DrinkTemperature"),
  ('BEV-019', 'COLD'::"DrinkTemperature"),
  ('BEV-020', 'COLD'::"DrinkTemperature"),
  ('BEV-021', 'COLD'::"DrinkTemperature"),
  ('BEV-022','COLD'::"DrinkTemperature"),
  ('BEV-023', 'BOTH'::"DrinkTemperature"),
  ('BEV-024', 'COLD'::"DrinkTemperature"),
  ('ESP-01', 'BOTH'::"DrinkTemperature"),
  ('ESP-02', 'BOTH'::"DrinkTemperature")
) AS updates(sku, temperature)
WHERE product.sku = updates.sku
  AND product."temperature" IS DISTINCT FROM updates.temperature;

COMMIT;