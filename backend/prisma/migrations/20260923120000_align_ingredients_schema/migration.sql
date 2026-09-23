-- TD-12: remove the long-standing drift between the ingredients table and schema.prisma.

-- deletedAt was created as TIMESTAMP(3) (20260921000000) but the schema declares
-- TIMESTAMPTZ(6) like every other timestamp. Prisma wrote those values in UTC.
-- ingredients_active_deleted_idx is rebuilt automatically.
-- Explicit transaction: Prisma Migrate does not wrap the script, and a failure halfway
-- would leave the table partly converted.
BEGIN;

ALTER TABLE "ingredients"
  ALTER COLUMN "deletedAt" TYPE TIMESTAMPTZ(6) USING "deletedAt" AT TIME ZONE 'UTC';

-- The partial unique index (WHERE sku IS NOT NULL) becomes a plain unique index: same
-- behaviour (multiple NULLs are allowed anyway) and it matches the schema, so
-- `prisma migrate diff` stops reporting it.
DROP INDEX "ingredients_sku_unique";
CREATE UNIQUE INDEX "ingredients_sku_unique" ON "ingredients"("sku");

-- ingredients_active_idx stays: it is now declared in schema.prisma (@@index([isActive])).

COMMIT;
