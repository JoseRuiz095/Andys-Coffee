-- The "Pago Pendiente" payment method (order.service.ts) creates Payment rows
-- with status = 'pending' for sales not yet collected (accounts receivable).
-- The existing CHECK constraint (added in 20260905210000_add_data_integrity_constraints)
-- only allowed ('paid', 'cancelled'), which the database was silently rejecting.
ALTER TABLE "payments" DROP CONSTRAINT "payments_status_check";

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_status_check"
  CHECK ("status" IN ('paid', 'cancelled', 'pending'));
