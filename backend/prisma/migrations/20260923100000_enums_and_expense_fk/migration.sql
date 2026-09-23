-- TD-05: free-text status columns -> enums, and a real FK for expenses."sourceOrderId".
--
-- Written by hand on purpose: for a String -> enum change `prisma migrate dev` generates
-- DROP COLUMN + ADD COLUMN, which would wipe every payment status, movement type, expense
-- category and delivery responsibility. Here every column is converted in place with USING.
-- A value outside the enum makes the cast fail and the whole migration rolls back, so nothing
-- is half-applied (check the production values first — see docs/auditoria-mvp-2026-09-22.md).
-- Explicit transaction: Prisma Migrate does not wrap the script, and a failure halfway
-- would leave the table partly converted.
BEGIN;

CREATE TYPE "PaymentStatus" AS ENUM ('paid', 'pending', 'cancelled');

CREATE TYPE "CashMovementType" AS ENUM (
  'OPENING', 'CLOSING', 'sale', 'sale_reversal', 'expense', 'expense_adjustment',
  'expense_reversal', 'delivery_collected', 'delivery_handoff', 'delivery_collected_reversal'
);

CREATE TYPE "DeliveryResponsible" AS ENUM ('customer_to_courier', 'customer_to_business', 'business_absorbs');

CREATE TYPE "ExpenseCategory" AS ENUM ('insumos', 'servicios', 'mantenimiento', 'nomina', 'renta', 'mandadito', 'otros');

-- payments.status: the text CHECK, the text default and the partial index predicate
-- (status = 'paid'::text) all block the type change, so they go first and come back typed.
ALTER TABLE "payments" DROP CONSTRAINT "payments_status_check";
DROP INDEX "payments_paid_date_idx";
ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payments" ALTER COLUMN "status" TYPE "PaymentStatus" USING "status"::"PaymentStatus";
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'paid';
CREATE INDEX "payments_paid_date_idx" ON "payments"("paidAt") WHERE ("status" = 'paid'::"PaymentStatus");

-- cash_movements.type: the enum replaces the CHECK list.
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_type_check";
ALTER TABLE "cash_movements" ALTER COLUMN "type" TYPE "CashMovementType" USING "type"::"CashMovementType";

-- expenses.category (had no CHECK; expenses_category_idx is rebuilt automatically).
ALTER TABLE "expenses" ALTER COLUMN "category" TYPE "ExpenseCategory" USING "category"::"ExpenseCategory";

-- orders.deliveryResponsible (nullable, had no CHECK).
ALTER TABLE "orders" ALTER COLUMN "deliveryResponsible" TYPE "DeliveryResponsible" USING "deliveryResponsible"::"DeliveryResponsible";

-- expenses.sourceOrderId -> orders.id. SET NULL: an expense is a financial record and must
-- survive its order (orders are never deleted in production; tests clean orders up first).
-- Orphans (if any) are cleared first, otherwise the constraint could not be created.
UPDATE "expenses" e SET "sourceOrderId" = NULL
WHERE e."sourceOrderId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "orders" o WHERE o."id" = e."sourceOrderId");

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

COMMIT;
