-- Pre-existing bug fix: this CHECK constraint (added in
-- 20260905210000_add_data_integrity_constraints) only allowed
-- ('OPENING', 'CLOSING', 'sale', 'sale_reversal'), but expense.service.ts has
-- always written 'expense', 'expense_adjustment' and 'expense_reversal' rows,
-- which the database was silently rejecting for any cash-method expense.
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_type_check";

ALTER TABLE "cash_movements"
  ADD CONSTRAINT "cash_movements_type_check"
  CHECK ("type" IN ('OPENING', 'CLOSING', 'sale', 'sale_reversal', 'expense', 'expense_adjustment', 'expense_reversal'));
