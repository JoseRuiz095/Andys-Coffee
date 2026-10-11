CREATE TYPE "DrinkTemperature" AS ENUM ('HOT', 'COLD');

ALTER TABLE "order_items"
  ADD COLUMN "temperature" "DrinkTemperature";