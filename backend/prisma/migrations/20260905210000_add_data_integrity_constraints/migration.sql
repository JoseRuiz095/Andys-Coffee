-- Nullable SKUs may repeat NULL, but every concrete SKU must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS "ingredients_sku_unique" ON "ingredients"("sku");

ALTER TABLE "ingredients"
  ADD CONSTRAINT "ingredients_stock_nonnegative_check"
  CHECK ("currentStock" >= 0 AND "minimumStock" >= 0 AND "averageCost" >= 0);

ALTER TABLE "products"
  ADD CONSTRAINT "products_prices_nonnegative_check"
  CHECK ("price" >= 0 AND "cost" >= 0);

ALTER TABLE "extras"
  ADD CONSTRAINT "extras_prices_nonnegative_check"
  CHECK ("price" >= 0 AND "cost" >= 0);

ALTER TABLE "combos"
  ADD CONSTRAINT "combos_prices_nonnegative_check"
  CHECK ("price" >= 0 AND "cost" >= 0);

ALTER TABLE "cash_sessions"
  ADD CONSTRAINT "cash_sessions_status_check"
  CHECK ("status" IN ('open', 'closed'));

ALTER TABLE "cash_movements"
  ADD CONSTRAINT "cash_movements_type_check"
  CHECK ("type" IN ('OPENING', 'CLOSING', 'sale', 'sale_reversal'));

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_status_check"
  CHECK ("status" IN ('paid', 'cancelled'));

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive_check"
  CHECK ("quantity" > 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amounts_nonnegative_check"
  CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "tax" >= 0 AND "total" >= 0);