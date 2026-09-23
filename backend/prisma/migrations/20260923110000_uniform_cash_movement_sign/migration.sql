-- TD-10: one sign convention for cash_movements.amount — the signed effect on the drawer
-- (+ money in, - money out). CLOSING keeps recording the counted cash.
--
-- Until now three types were stored with the opposite sign of their effect:
--   expense           stored +X, took X out of the drawer      -> -X
--   expense_reversal  stored -X, put X back into the drawer    -> +X
--   delivery_handoff  stored +X, paid X to the courier         -> -X
-- Every other type was already stored as its effect.
--
-- Deploy with the backend STOPPED and start the new code right after: the old code would
-- keep writing the old signs and the 23:30 reconciliation would report false differences.
UPDATE "cash_movements"
SET "amount" = -"amount"
WHERE "type" IN ('expense', 'expense_reversal', 'delivery_handoff');
