-- Real-time inventory + catalog normalization, step 1 (docs/Project/plan-inventario-tiempo-real.md, F1).
-- Additive only: new enums, tables and nullable/defaulted columns, plus relaxed or new CHECKs.
-- No column is dropped or retyped. Constraints that need cleaned-up data (unique unit names,
-- NOT NULL ingredient SKU, unique product names, VALIDATE of the NOT VALID checks below) come
-- in step 2, after scripts/normalize-catalog.ts.
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------------------------
CREATE TYPE "UnitDimension" AS ENUM ('MASS', 'VOLUME', 'COUNT');
CREATE TYPE "ProductSize" AS ENUM ('REGULAR', 'JUMBO');

-- ---------------------------------------------------------------------------------------------
-- Units: dimension + conversion factor to the base unit (gr, ml, pz = 1)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "inventory_units"
  ADD COLUMN "dimension" "UnitDimension" NOT NULL DEFAULT 'COUNT',
  ADD COLUMN "factor" DECIMAL(14, 6) NOT NULL DEFAULT 1;

UPDATE "inventory_units" SET "dimension" = 'MASS', "factor" = 1
  WHERE LOWER(TRIM("abbreviation")) IN ('gr', 'g') OR LOWER(TRIM("name")) IN ('gramo', 'gramos', 'g', 'gr');
UPDATE "inventory_units" SET "dimension" = 'MASS', "factor" = 1000
  WHERE LOWER(TRIM("abbreviation")) = 'kg' OR LOWER(TRIM("name")) IN ('kilogramo', 'kilogramos', 'kg');
UPDATE "inventory_units" SET "dimension" = 'VOLUME', "factor" = 1
  WHERE LOWER(TRIM("abbreviation")) = 'ml' OR LOWER(TRIM("name")) IN ('mililitro', 'mililitros', 'ml');
UPDATE "inventory_units" SET "dimension" = 'VOLUME', "factor" = 1000
  WHERE LOWER(TRIM("abbreviation")) IN ('lt', 'l') OR LOWER(TRIM("name")) IN ('litro', 'litros', 'l', 'lt');
-- Pieces (and anything unrecognized) keep COUNT / 1; normalize-catalog.ts reports the latter.

ALTER TABLE "inventory_units"
  ADD CONSTRAINT "inventory_units_factor_positive_check" CHECK ("factor" > 0);

-- ---------------------------------------------------------------------------------------------
-- Ingredients: optional maximum stock; stock may go negative (decision D-1)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "ingredients" ADD COLUMN "maximumStock" DECIMAL(14, 4);

ALTER TABLE "ingredients" DROP CONSTRAINT "ingredients_stock_nonnegative_check";
ALTER TABLE "ingredients"
  ADD CONSTRAINT "ingredients_stock_nonnegative_check"
  CHECK ("minimumStock" >= 0 AND "averageCost" >= 0);
ALTER TABLE "ingredients"
  ADD CONSTRAINT "ingredients_maximum_stock_check"
  CHECK ("maximumStock" IS NULL OR "maximumStock" >= "minimumStock");

-- ---------------------------------------------------------------------------------------------
-- Categories: explicit beverage flag (replaces matching the name "Bebidas")
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "categories" ADD COLUMN "isBeverage" BOOLEAN NOT NULL DEFAULT false;
UPDATE "categories" SET "isBeverage" = true WHERE LOWER(TRIM("name")) = 'bebidas';

-- ---------------------------------------------------------------------------------------------
-- Product families and variant options (POS grouping without parsing product names)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE "product_families" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_families_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "productFamilies_category_idx" ON "product_families"("categoryId");
-- Expression index, not expressible in schema.prisma.
CREATE UNIQUE INDEX "productFamilies_name_normalized_unique" ON "product_families"(LOWER(TRIM("name")));
ALTER TABLE "product_families" ADD CONSTRAINT "product_families_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "products"
  ADD COLUMN "tracksInventory" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "familyId" TEXT,
  ADD COLUMN "variantLabel" TEXT;
CREATE INDEX "products_family_idx" ON "products"("familyId");
ALTER TABLE "products" ADD CONSTRAINT "products_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "product_families"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE "product_variant_options" (
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "product_variant_options_pkey" PRIMARY KEY ("productId", "name")
);
ALTER TABLE "product_variant_options" ADD CONSTRAINT "product_variant_options_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ---------------------------------------------------------------------------------------------
-- Recipes per size (decision D-3). Existing recipes become REGULAR.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "recipes" ADD COLUMN "size" "ProductSize" NOT NULL DEFAULT 'REGULAR';
DROP INDEX "recipes_unique";
CREATE UNIQUE INDEX "recipes_unique" ON "recipes"("productId", "size", "ingredientId");
-- NOT VALID: enforced for new/updated rows now, validated in step 2 once the data is checked.
ALTER TABLE "recipes"
  ADD CONSTRAINT "recipes_quantity_positive_check" CHECK ("quantity" > 0) NOT VALID;
-- Extras may subtract (substitutions, "sin azúcar"), but a zero line is meaningless.
ALTER TABLE "extra_recipes"
  ADD CONSTRAINT "extra_recipes_quantity_nonzero_check" CHECK ("quantity" <> 0) NOT VALID;

-- ---------------------------------------------------------------------------------------------
-- Order lines remember their size (the recipe applied and reports)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "order_items" ADD COLUMN "size" "ProductSize" NOT NULL DEFAULT 'REGULAR';
-- Jumbo lines have always been named "<product> Jumbo" by the server (sale-pricing.service).
UPDATE "order_items" AS oi SET "size" = 'JUMBO'
  FROM "products" AS p
  WHERE oi."productId" = p."id" AND oi."productName" = p."name" || ' Jumbo';

-- ---------------------------------------------------------------------------------------------
-- Inventory movements: balance after the movement, originating order line, known types and
-- one sale / one reversal per order line and ingredient (DB-level idempotency)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "inventory_movements"
  ADD COLUMN "balanceAfter" DECIMAL(14, 4),
  ADD COLUMN "orderItemId" TEXT;
CREATE INDEX "inventoryMovements_orderItem_idx" ON "inventory_movements"("orderItemId");
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_type_check"
  CHECK ("type" IN ('purchase', 'exit', 'adjustment', 'sale', 'sale_reversal')) NOT VALID;

-- Partial unique indexes, not expressible in schema.prisma.
CREATE UNIQUE INDEX "inventoryMovements_sale_once"
  ON "inventory_movements"("orderItemId", "ingredientId")
  WHERE "type" = 'sale' AND "orderItemId" IS NOT NULL;
CREATE UNIQUE INDEX "inventoryMovements_sale_reversal_once"
  ON "inventory_movements"("orderItemId", "ingredientId")
  WHERE "type" = 'sale_reversal' AND "orderItemId" IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- Permission to edit recipes (granted to ADMIN; the seed assigns it too) and feature flags
-- ---------------------------------------------------------------------------------------------
INSERT INTO "permissions" ("id", "name", "description", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'inventory.manage_recipes', 'Editar recetas de productos y extras', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", NOW()
FROM "roles" r, "permissions" p
WHERE r."name" = 'ADMIN' AND p."name" = 'inventory.manage_recipes'
ON CONFLICT DO NOTHING;

INSERT INTO "system_preferences" ("id", "key", "value", "type", "label", "description", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'inventory.consumeOnSale', 'false', 'boolean',
   'Descontar inventario al vender', 'Cada venta descuenta los insumos de la receta de sus productos y extras.', NOW(), NOW()),
  (gen_random_uuid()::text, 'inventory.lowStockNotify', 'true', 'boolean',
   'Avisar stock bajo', 'Notifica cuando un insumo llega a su stock mínimo o se agota.', NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

COMMIT;
