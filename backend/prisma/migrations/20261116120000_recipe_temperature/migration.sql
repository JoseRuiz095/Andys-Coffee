-- Recipes per temperature (2026-11-16): a product sold hot and cold (Latte, Americano, Chai…)
-- uses a different cup, lid, ice and milk amount. Each recipe line now says which temperature it
-- belongs to; BOTH (the default, so existing lines keep their meaning) applies to either one.
-- A sale consumes the lines of its size whose temperature is BOTH or the line's temperature.
BEGIN;

ALTER TABLE "recipes" ADD COLUMN "temperature" "DrinkTemperature" NOT NULL DEFAULT 'BOTH';

DROP INDEX "recipes_unique";
CREATE UNIQUE INDEX "recipes_unique" ON "recipes"("productId", "size", "temperature", "ingredientId");

COMMIT;
