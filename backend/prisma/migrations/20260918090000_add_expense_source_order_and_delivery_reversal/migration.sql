-- Links an auto-generated expense (e.g. a 'mandadito' Andy's absorbs) back to the order
-- that created it, so cancelling that order can find and remove the derived expense
-- instead of leaving it counted in Gastos Variables after the sale no longer exists.
ALTER TABLE "expenses" ADD COLUMN "sourceOrderId" TEXT;

CREATE INDEX "expenses_sourceOrderId_idx" ON "expenses"("sourceOrderId");

-- Bug fix: cancelling an order only reversed 'sale' cash movements, never the
-- 'delivery_collected' movement (third-party mandadito cash collected by Andy's,
-- pending handoff to the courier). Add the reversal type so cancellation can undo it.
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_type_check";

ALTER TABLE "cash_movements"
  ADD CONSTRAINT "cash_movements_type_check"
  CHECK ("type" IN ('OPENING', 'CLOSING', 'sale', 'sale_reversal', 'expense', 'expense_adjustment', 'expense_reversal', 'delivery_collected', 'delivery_handoff', 'delivery_collected_reversal'));
