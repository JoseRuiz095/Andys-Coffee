-- QA audit 2026-11-18 (docs/Project/AUDIT/auditoria-qa-integral-2026-11-18.md).
--
-- D-11: costs per base unit (gr, ml) need more than 4 decimals: 3 kg of salt for $25 is
--   $0.008333/gr and was stored as 0.0083 ($24.90). Widening NUMERIC(14,4) → NUMERIC(18,8) keeps
--   the same 10 integer digits, so every existing value fits and nothing is rounded.
-- D-02: e-mail uniqueness ignoring case and surrounding spaces (the service already checked it
--   that way; login now looks the address up the same way). Fails — and the whole migration rolls
--   back — if two users differ only by case. Pre-check:
--     SELECT LOWER(TRIM(email)), COUNT(*) FROM users GROUP BY 1 HAVING COUNT(*) > 1;
-- D-06: product SKU uniqueness ignoring case and spaces. Pre-check:
--     SELECT UPPER(TRIM(sku)), COUNT(*) FROM products GROUP BY 1 HAVING COUNT(*) > 1;
-- No data is modified.
BEGIN;

ALTER TABLE "ingredients" ALTER COLUMN "averageCost" TYPE NUMERIC(18, 8);
ALTER TABLE "inventory_movements" ALTER COLUMN "unitCost" TYPE NUMERIC(18, 8);
ALTER TABLE "purchase_items" ALTER COLUMN "unitCost" TYPE NUMERIC(18, 8);

CREATE UNIQUE INDEX "users_email_normalized_unique" ON "users"(LOWER(TRIM("email")));
CREATE UNIQUE INDEX "products_sku_normalized_unique" ON "products"(UPPER(TRIM("sku")));

COMMIT;
