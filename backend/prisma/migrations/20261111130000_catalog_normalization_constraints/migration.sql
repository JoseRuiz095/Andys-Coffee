-- Real-time inventory + catalog normalization, step 2 (docs/Project/plan-inventario-tiempo-real.md, F2).
-- Constraints that need cleaned-up data. Run `npx tsx scripts/normalize-catalog.ts --apply`
-- on the target database FIRST: the checks below abort the migration (nothing is changed)
-- and say what to fix if duplicates or invalid rows remain.
-- No explicit BEGIN/COMMIT: the script runs as one implicit transaction, and an explicit
-- COMMIT after the RAISE would replace its message with "current transaction is aborted".
-- If it fails, fix the data and run `prisma migrate resolve --rolled-back <this migration>`.

DO $$
DECLARE
  problems TEXT := '';
  n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM (
    SELECT LOWER(TRIM("name")) FROM "inventory_units" GROUP BY 1 HAVING COUNT(*) > 1) d;
  IF n > 0 THEN problems := problems || format(' %s nombre(s) de unidad repetido(s);', n); END IF;

  SELECT COUNT(*) INTO n FROM (
    SELECT LOWER(TRIM("abbreviation")) FROM "inventory_units" GROUP BY 1 HAVING COUNT(*) > 1) d;
  IF n > 0 THEN problems := problems || format(' %s abreviatura(s) de unidad repetida(s);', n); END IF;

  SELECT COUNT(*) INTO n FROM (
    SELECT LOWER(TRIM("name")) FROM "products" WHERE "isActive" GROUP BY 1 HAVING COUNT(*) > 1) d;
  IF n > 0 THEN problems := problems || format(' %s nombre(s) de producto activo repetido(s);', n); END IF;

  SELECT COUNT(*) INTO n FROM "recipes" WHERE "quantity" <= 0;
  IF n > 0 THEN problems := problems || format(' %s receta(s) con cantidad <= 0;', n); END IF;

  SELECT COUNT(*) INTO n FROM "extra_recipes" WHERE "quantity" = 0;
  IF n > 0 THEN problems := problems || format(' %s receta(s) de extra con cantidad 0;', n); END IF;

  SELECT COUNT(*) INTO n FROM "inventory_movements"
    WHERE "type" NOT IN ('purchase', 'exit', 'adjustment', 'sale', 'sale_reversal');
  IF n > 0 THEN problems := problems || format(' %s movimiento(s) con tipo desconocido;', n); END IF;

  IF problems <> '' THEN
    RAISE EXCEPTION 'Datos sin normalizar:% Ejecuta scripts/normalize-catalog.ts y corrige los avisos.', problems;
  END IF;
END $$;

-- One unit per name and per abbreviation (no more "g" next to "gr").
CREATE UNIQUE INDEX "inventory_units_name_normalized_unique" ON "inventory_units"(LOWER(TRIM("name")));
CREATE UNIQUE INDEX "inventory_units_abbreviation_normalized_unique" ON "inventory_units"(LOWER(TRIM("abbreviation")));

-- Active products can't repeat a name (same rule as ingredients and suppliers).
CREATE UNIQUE INDEX "products_name_normalized_unique" ON "products"(LOWER(TRIM("name"))) WHERE "isActive" = true;

-- The NOT VALID checks of step 1 now also hold for existing rows.
ALTER TABLE "recipes" VALIDATE CONSTRAINT "recipes_quantity_positive_check";
ALTER TABLE "extra_recipes" VALIDATE CONSTRAINT "extra_recipes_quantity_nonzero_check";
ALTER TABLE "inventory_movements" VALIDATE CONSTRAINT "inventory_movements_type_check";

