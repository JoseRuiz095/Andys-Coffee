-- Adds delivery ("mandadito") tracking fields to orders. The delivery amount is
-- intentionally NOT part of subtotal/total — it is never revenue for Andy's.
ALTER TABLE "orders"
  ADD COLUMN "hasDelivery" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deliveryAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "deliveryResponsible" TEXT,
  ADD COLUMN "deliveryPaymentMethod" TEXT,
  ADD COLUMN "deliveryHandedOff" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deliveryHandedOffAt" TIMESTAMPTZ(6);

-- Expand the cash_movements type CHECK (added in 20260905210000_add_data_integrity_constraints,
-- last expanded in 20260917121000_fix_cash_movements_type_check) to allow the two new delivery
-- movement types used by order.service.ts: 'delivery_collected' (third-party cash entering the
-- drawer, not revenue) and 'delivery_handoff' (that cash leaving the drawer to the courier).
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_type_check";

ALTER TABLE "cash_movements"
  ADD CONSTRAINT "cash_movements_type_check"
  CHECK ("type" IN ('OPENING', 'CLOSING', 'sale', 'sale_reversal', 'expense', 'expense_adjustment', 'expense_reversal', 'delivery_collected', 'delivery_handoff'));
