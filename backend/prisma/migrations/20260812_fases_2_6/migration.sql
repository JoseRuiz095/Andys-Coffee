/*
============================================================
ANDY'S COFFEE
MIGRACIÓN INCREMENTAL - FASES 3, 4, 5 Y 6
============================================================

BASE:
- Supabase actual
- Tablas existentes NO se recrean
- RLS NO se elimina
- CHECK constraints existentes NO se eliminan

AGREGA:
1. Costos históricos
2. Automatización de compras
3. Automatización de inventario
4. Automatización de ventas
5. Caja
6. Gastos
7. Tickets
8. Dashboard
9. Índices
10. Triggers de actualización

============================================================
*/


-- ============================================================
-- 0. EXTENSIÓN
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 1. COSTOS HISTÓRICOS DE VENTA
-- ============================================================

ALTER TABLE public."orderItems"
ADD COLUMN IF NOT EXISTS "costSnapshot"
numeric NOT NULL DEFAULT 0;

ALTER TABLE public."orderItemExtras"
ADD COLUMN IF NOT EXISTS "costSnapshot"
numeric NOT NULL DEFAULT 0;


-- ============================================================
-- 2. ÍNDICES ÚNICOS DE NEGOCIO
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS "recipes_product_ingredient_unique"
ON public."recipes" ("productId", "ingredientId");


CREATE UNIQUE INDEX IF NOT EXISTS "extraRecipes_extra_ingredient_unique"
ON public."extraRecipes" ("extraId", "ingredientId");


CREATE UNIQUE INDEX IF NOT EXISTS "comboItems_combo_product_unique"
ON public."comboItems" ("comboId", "productId");


CREATE UNIQUE INDEX IF NOT EXISTS "cashSessions_one_open_per_register"
ON public."cashSessions" ("cashRegisterId")
WHERE "status" = 'open';


-- ============================================================
-- 3. ÍNDICES PARA OPERACIÓN Y REPORTES
-- ============================================================

CREATE INDEX IF NOT EXISTS "orders_status_createdAt_idx"
ON public."orders" ("status", "createdAt");


CREATE INDEX IF NOT EXISTS "orders_completedAt_idx"
ON public."orders" ("completedAt");


CREATE INDEX IF NOT EXISTS "orderItems_product_order_idx"
ON public."orderItems" ("productId", "orderId");


CREATE INDEX IF NOT EXISTS "orderItems_combo_order_idx"
ON public."orderItems" ("comboId", "orderId");


CREATE INDEX IF NOT EXISTS "orderItemExtras_extra_idx"
ON public."orderItemExtras" ("extraId");


CREATE INDEX IF NOT EXISTS "payments_method_paidAt_idx"
ON public."payments" ("method", "paidAt");


CREATE INDEX IF NOT EXISTS "cashMovements_session_createdAt_idx"
ON public."cashMovements" ("cashSessionId", "createdAt");


CREATE INDEX IF NOT EXISTS "inventoryMovements_ingredient_createdAt_idx"
ON public."inventoryMovements" ("ingredientId", "createdAt");


CREATE INDEX IF NOT EXISTS "purchases_status_purchasedAt_idx"
ON public."purchases" ("status", "purchasedAt");


CREATE INDEX IF NOT EXISTS "expenses_category_date_idx"
ON public."expenses" ("category", "expenseDate");


-- ============================================================
-- 4. ACTUALIZAR updatedAt AUTOMÁTICAMENTE
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS "categories_set_updatedAt"
ON public."categories";

CREATE TRIGGER "categories_set_updatedAt"
BEFORE UPDATE ON public."categories"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS "products_set_updatedAt"
ON public."products";

CREATE TRIGGER "products_set_updatedAt"
BEFORE UPDATE ON public."products"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS "extras_set_updatedAt"
ON public."extras";

CREATE TRIGGER "extras_set_updatedAt"
BEFORE UPDATE ON public."extras"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS "combos_set_updatedAt"
ON public."combos";

CREATE TRIGGER "combos_set_updatedAt"
BEFORE UPDATE ON public."combos"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS "ingredients_set_updatedAt"
ON public."ingredients";

CREATE TRIGGER "ingredients_set_updatedAt"
BEFORE UPDATE ON public."ingredients"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS "recipes_set_updatedAt"
ON public."recipes";

CREATE TRIGGER "recipes_set_updatedAt"
BEFORE UPDATE ON public."recipes"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS "suppliers_set_updatedAt"
ON public."suppliers";

CREATE TRIGGER "suppliers_set_updatedAt"
BEFORE UPDATE ON public."suppliers"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS "purchases_set_updatedAt"
ON public."purchases";

CREATE TRIGGER "purchases_set_updatedAt"
BEFORE UPDATE ON public."purchases"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS "cashRegisters_set_updatedAt"
ON public."cashRegisters";

CREATE TRIGGER "cashRegisters_set_updatedAt"
BEFORE UPDATE ON public."cashRegisters"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS "orders_set_updatedAt"
ON public."orders";

CREATE TRIGGER "orders_set_updatedAt"
BEFORE UPDATE ON public."orders"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 5. COSTO HISTÓRICO DE ORDER ITEMS
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_order_item_cost_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_cost numeric;
BEGIN

    IF NEW."productId" IS NOT NULL THEN

        SELECT COALESCE("cost", 0)
        INTO v_cost
        FROM public."products"
        WHERE "id" = NEW."productId";

        NEW."costSnapshot" = COALESCE(v_cost, 0);

    ELSIF NEW."comboId" IS NOT NULL THEN

        SELECT
            COALESCE(
                SUM(
                    ci."quantity" * p."cost"
                ),
                0
            )
        INTO v_cost
        FROM public."comboItems" ci
        INNER JOIN public."products" p
            ON p."id" = ci."productId"
        WHERE ci."comboId" = NEW."comboId";

        NEW."costSnapshot" = COALESCE(v_cost, 0);

    END IF;

    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS "orderItems_set_cost_snapshot"
ON public."orderItems";

CREATE TRIGGER "orderItems_set_cost_snapshot"
BEFORE INSERT
ON public."orderItems"
FOR EACH ROW
EXECUTE FUNCTION public.set_order_item_cost_snapshot();


-- ============================================================
-- 6. COSTO HISTÓRICO DE EXTRAS
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_order_extra_cost_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_cost numeric;
BEGIN

    IF NEW."extraId" IS NOT NULL THEN

        SELECT COALESCE("cost", 0)
        INTO v_cost
        FROM public."extras"
        WHERE "id" = NEW."extraId";

        NEW."costSnapshot" = COALESCE(v_cost, 0);

    END IF;

    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS "orderItemExtras_set_cost_snapshot"
ON public."orderItemExtras";

CREATE TRIGGER "orderItemExtras_set_cost_snapshot"
BEFORE INSERT
ON public."orderItemExtras"
FOR EACH ROW
EXECUTE FUNCTION public.set_order_extra_cost_snapshot();


-- ============================================================
-- 7. RELLENAR COSTOS DE VENTAS EXISTENTES
-- ============================================================

UPDATE public."orderItems" oi
SET "costSnapshot" =
    CASE

        WHEN oi."productId" IS NOT NULL THEN
            COALESCE(
                (
                    SELECT p."cost"
                    FROM public."products" p
                    WHERE p."id" = oi."productId"
                ),
                0
            )

        WHEN oi."comboId" IS NOT NULL THEN
            COALESCE(
                (
                    SELECT SUM(
                        ci."quantity" * p."cost"
                    )
                    FROM public."comboItems" ci
                    INNER JOIN public."products" p
                        ON p."id" = ci."productId"
                    WHERE ci."comboId" = oi."comboId"
                ),
                0
            )

        ELSE 0

    END;


UPDATE public."orderItemExtras" oe
SET "costSnapshot" =
    COALESCE(
        (
            SELECT e."cost"
            FROM public."extras" e
            WHERE e."id" = oe."extraId"
        ),
        0
    );


-- ============================================================
-- 8. TOTAL DE PURCHASE ITEM
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_purchase_item_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN

    NEW."total" =
        ROUND(
            NEW."quantity" * NEW."unitCost",
            2
        );

    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS "purchaseItems_calculate_total"
ON public."purchaseItems";

CREATE TRIGGER "purchaseItems_calculate_total"
BEFORE INSERT OR UPDATE
ON public."purchaseItems"
FOR EACH ROW
EXECUTE FUNCTION public.calculate_purchase_item_total();


-- ============================================================
-- 9. RECALCULAR TOTAL DE COMPRA
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_purchase_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_purchase_id text;
    v_subtotal numeric;
    v_tax numeric;
BEGIN

    v_purchase_id =
        COALESCE(
            NEW."purchaseId",
            OLD."purchaseId"
        );


    SELECT
        COALESCE(SUM("total"), 0)
    INTO v_subtotal
    FROM public."purchaseItems"
    WHERE "purchaseId" = v_purchase_id;


    SELECT
        COALESCE("tax", 0)
    INTO v_tax
    FROM public."purchases"
    WHERE "id" = v_purchase_id;


    UPDATE public."purchases"
    SET
        "subtotal" = v_subtotal,
        "total" = v_subtotal + v_tax
    WHERE "id" = v_purchase_id;


    RETURN COALESCE(NEW, OLD);

END;
$$;


DROP TRIGGER IF EXISTS "purchaseItems_recalculate_purchase"
ON public."purchaseItems";

CREATE TRIGGER "purchaseItems_recalculate_purchase"
AFTER INSERT OR UPDATE OR DELETE
ON public."purchaseItems"
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_purchase_total();


-- ============================================================
-- 10. RECIBIR COMPRA
-- ============================================================

CREATE OR REPLACE FUNCTION public.receive_purchase(
    p_purchase_id text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_purchase record;
    v_item record;

    v_old_stock numeric;
    v_old_average numeric;
    v_new_stock numeric;
    v_new_average numeric;
BEGIN

    SELECT *
    INTO v_purchase
    FROM public."purchases"
    WHERE "id" = p_purchase_id
    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Purchase not found: %',
            p_purchase_id;
    END IF;


    IF v_purchase."status" = 'received' THEN
        RETURN;
    END IF;


    IF v_purchase."status" = 'cancelled' THEN
        RAISE EXCEPTION
            'Cancelled purchase cannot be received';
    END IF;


    FOR v_item IN
        SELECT *
        FROM public."purchaseItems"
        WHERE "purchaseId" = p_purchase_id
    LOOP

        SELECT
            "currentStock",
            "averageCost"
        INTO
            v_old_stock,
            v_old_average
        FROM public."ingredients"
        WHERE "id" = v_item."ingredientId"
        FOR UPDATE;


        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Ingredient not found: %',
                v_item."ingredientId";
        END IF;


        v_new_stock =
            v_old_stock + v_item."quantity";


        IF v_new_stock > 0 THEN

            v_new_average =
                (
                    (
                        v_old_stock * v_old_average
                    )
                    +
                    (
                        v_item."quantity"
                        * v_item."unitCost"
                    )
                )
                / v_new_stock;

        ELSE

            v_new_average =
                v_item."unitCost";

        END IF;


        UPDATE public."ingredients"
        SET
            "currentStock" = v_new_stock,
            "averageCost" = v_new_average
        WHERE "id" = v_item."ingredientId";


        INSERT INTO public."inventoryMovements" (
            "ingredientId",
            "type",
            "quantity",
            "unitCost",
            "referenceType",
            "referenceId",
            "notes",
            "createdById"
        )
        VALUES (
            v_item."ingredientId",
            'purchase',
            v_item."quantity",
            v_item."unitCost",
            'purchase',
            p_purchase_id,
            'Automatic inventory entry from purchase',
            v_purchase."createdById"
        );

    END LOOP;


    UPDATE public."purchases"
    SET
        "status" = 'received'
    WHERE "id" = p_purchase_id;

END;
$$;


-- ============================================================
-- 11. VALIDAR STOCK
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_ingredient_stock(
    p_ingredient_id text,
    p_quantity numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_stock numeric;
    v_name text;
BEGIN

    SELECT
        "currentStock",
        "name"
    INTO
        v_stock,
        v_name
    FROM public."ingredients"
    WHERE "id" = p_ingredient_id
    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Ingredient not found: %',
            p_ingredient_id;
    END IF;


    IF v_stock < p_quantity THEN
        RAISE EXCEPTION
            'Insufficient stock for "%". Available: %, required: %',
            v_name,
            v_stock,
            p_quantity;
    END IF;

END;
$$;


-- ============================================================
-- 12. CONSUMIR INGREDIENTE
-- ============================================================

CREATE OR REPLACE FUNCTION public.consume_ingredient(
    p_ingredient_id text,
    p_quantity numeric,
    p_order_id text,
    p_created_by text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_average_cost numeric;
BEGIN

    PERFORM public.validate_ingredient_stock(
        p_ingredient_id,
        p_quantity
    );


    SELECT "averageCost"
    INTO v_average_cost
    FROM public."ingredients"
    WHERE "id" = p_ingredient_id;


    UPDATE public."ingredients"
    SET
        "currentStock" =
            "currentStock" - p_quantity
    WHERE "id" = p_ingredient_id;


    INSERT INTO public."inventoryMovements" (
        "ingredientId",
        "type",
        "quantity",
        "unitCost",
        "referenceType",
        "referenceId",
        "notes",
        "createdById"
    )
    VALUES (
        p_ingredient_id,
        'sale',
        -p_quantity,
        COALESCE(v_average_cost, 0),
        'order',
        p_order_id,
        'Automatic inventory consumption from sale',
        p_created_by
    );

END;
$$;


-- ============================================================
-- 13. CONSUMIR RECETA DE PRODUCTO
-- ============================================================

CREATE OR REPLACE FUNCTION public.consume_product_recipe(
    p_product_id text,
    p_product_quantity numeric,
    p_order_id text,
    p_created_by text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_recipe record;
BEGIN

    FOR v_recipe IN
        SELECT *
        FROM public."recipes"
        WHERE "productId" = p_product_id
    LOOP

        PERFORM public.consume_ingredient(
            v_recipe."ingredientId",
            v_recipe."quantity"
            * p_product_quantity,
            p_order_id,
            p_created_by
        );

    END LOOP;

END;
$$;


-- ============================================================
-- 14. CONSUMIR RECETA DE EXTRA
-- ============================================================

CREATE OR REPLACE FUNCTION public.consume_extra_recipe(
    p_extra_id text,
    p_extra_quantity numeric,
    p_order_id text,
    p_created_by text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_recipe record;
BEGIN

    FOR v_recipe IN
        SELECT *
        FROM public."extraRecipes"
        WHERE "extraId" = p_extra_id
    LOOP

        PERFORM public.consume_ingredient(
            v_recipe."ingredientId",
            v_recipe."quantity"
            * p_extra_quantity,
            p_order_id,
            p_created_by
        );

    END LOOP;

END;
$$;


-- ============================================================
-- 15. PROCESAR INVENTARIO DE PEDIDO
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_order_inventory(
    p_order_id text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_order record;
    v_item record;
    v_extra record;
    v_combo_item record;
BEGIN

    SELECT *
    INTO v_order
    FROM public."orders"
    WHERE "id" = p_order_id
    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Order not found: %',
            p_order_id;
    END IF;


    IF v_order."inventoryProcessed" = true THEN
        RETURN;
    END IF;


    FOR v_item IN
        SELECT *
        FROM public."orderItems"
        WHERE "orderId" = p_order_id
    LOOP

        IF v_item."productId" IS NOT NULL THEN

            PERFORM public.consume_product_recipe(
                v_item."productId",
                v_item."quantity",
                p_order_id,
                v_order."createdById"
            );

        END IF;


        IF v_item."comboId" IS NOT NULL THEN

            FOR v_combo_item IN
                SELECT *
                FROM public."comboItems"
                WHERE "comboId" = v_item."comboId"
            LOOP

                PERFORM public.consume_product_recipe(
                    v_combo_item."productId",
                    v_combo_item."quantity"
                    * v_item."quantity",
                    p_order_id,
                    v_order."createdById"
                );

            END LOOP;

        END IF;


        FOR v_extra IN
            SELECT *
            FROM public."orderItemExtras"
            WHERE "orderItemId" = v_item."id"
        LOOP

            IF v_extra."extraId" IS NOT NULL THEN

                PERFORM public.consume_extra_recipe(
                    v_extra."extraId",
                    v_extra."quantity",
                    p_order_id,
                    v_order."createdById"
                );

            END IF;

        END LOOP;

    END LOOP;


    UPDATE public."orders"
    SET
        "inventoryProcessed" = true
    WHERE "id" = p_order_id;

END;
$$;


-- ============================================================
-- 16. APERTURA DE CAJA
-- ============================================================

CREATE OR REPLACE FUNCTION public.open_cash_session(
    p_cash_register_id text,
    p_user_id text,
    p_opening_amount numeric
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_session_id text;
BEGIN

    IF p_opening_amount < 0 THEN
        RAISE EXCEPTION
            'Opening amount cannot be negative';
    END IF;


    IF EXISTS (
        SELECT 1
        FROM public."cashSessions"
        WHERE "cashRegisterId" = p_cash_register_id
        AND "status" = 'open'
    ) THEN

        RAISE EXCEPTION
            'Cash register already has an open session';

    END IF;


    INSERT INTO public."cashSessions" (
        "cashRegisterId",
        "openedById",
        "openingAmount"
    )
    VALUES (
        p_cash_register_id,
        p_user_id,
        p_opening_amount
    )
    RETURNING "id"
    INTO v_session_id;


    INSERT INTO public."cashMovements" (
        "cashSessionId",
        "type",
        "amount",
        "referenceType",
        "referenceId",
        "description",
        "createdById"
    )
    VALUES (
        v_session_id,
        'deposit',
        p_opening_amount,
        'cash_session',
        v_session_id,
        'Cash register opening',
        p_user_id
    );


    RETURN v_session_id;

END;
$$;


-- ============================================================
-- 17. EFECTIVO ESPERADO
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_expected_cash(
    p_cash_session_id text
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    v_opening numeric;
    v_in numeric;
    v_out numeric;
BEGIN

    SELECT
        COALESCE("openingAmount", 0)
    INTO v_opening
    FROM public."cashSessions"
    WHERE "id" = p_cash_session_id;


    SELECT
        COALESCE(
            SUM(
                CASE
                    WHEN "type" IN (
                        'sale',
                        'deposit',
                        'adjustment'
                    )
                    THEN "amount"
                    ELSE 0
                END
            ),
            0
        ),

        COALESCE(
            SUM(
                CASE
                    WHEN "type" IN (
                        'expense',
                        'withdrawal'
                    )
                    THEN "amount"
                    ELSE 0
                END
            ),
            0
        )

    INTO
        v_in,
        v_out

    FROM public."cashMovements"

    WHERE "cashSessionId" = p_cash_session_id;


    RETURN v_in - v_out;

END;
$$;


-- ============================================================
-- 18. CIERRE DE CAJA
-- ============================================================

CREATE OR REPLACE FUNCTION public.close_cash_session(
    p_cash_session_id text,
    p_user_id text,
    p_closing_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    v_expected numeric;
    v_difference numeric;
BEGIN

    IF p_closing_amount < 0 THEN
        RAISE EXCEPTION
            'Closing amount cannot be negative';
    END IF;


    v_expected =
        public.get_expected_cash(
            p_cash_session_id
        );


    v_difference =
        p_closing_amount - v_expected;


    UPDATE public."cashSessions"
    SET
        "status" = 'closed',
        "closedById" = p_user_id,
        "closingAmount" = p_closing_amount,
        "expectedAmount" = v_expected,
        "difference" = v_difference,
        "closedAt" = NOW()
    WHERE "id" = p_cash_session_id
    AND "status" = 'open';


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Cash session not found or already closed';
    END IF;


    RETURN v_difference;

END;
$$;


-- ============================================================
-- 19. REGISTRAR GASTO
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_expense(
    p_cash_session_id text,
    p_category text,
    p_description text,
    p_amount numeric,
    p_user_id text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_expense_id text;
BEGIN

    IF p_amount <= 0 THEN
        RAISE EXCEPTION
            'Expense amount must be greater than zero';
    END IF;


    INSERT INTO public."expenses" (
        "cashSessionId",
        "category",
        "description",
        "amount",
        "createdById"
    )
    VALUES (
        p_cash_session_id,
        p_category,
        p_description,
        p_amount,
        p_user_id
    )
    RETURNING "id"
    INTO v_expense_id;


    INSERT INTO public."cashMovements" (
        "cashSessionId",
        "type",
        "amount",
        "referenceType",
        "referenceId",
        "description",
        "createdById"
    )
    VALUES (
        p_cash_session_id,
        'expense',
        p_amount,
        'expense',
        v_expense_id,
        p_description,
        p_user_id
    );


    RETURN v_expense_id;

END;
$$;


-- ============================================================
-- 20. COMPLETAR PEDIDO
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_order(
    p_order_id text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_order record;
    v_payment record;
    v_paid numeric;
BEGIN

    SELECT *
    INTO v_order
    FROM public."orders"
    WHERE "id" = p_order_id
    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Order not found: %',
            p_order_id;
    END IF;


    IF v_order."status" = 'cancelled' THEN
        RAISE EXCEPTION
            'Cancelled order cannot be completed';
    END IF;


    IF v_order."status" = 'completed' THEN
        RETURN;
    END IF;


    SELECT
        COALESCE(SUM("amount"), 0)
    INTO v_paid
    FROM public."payments"
    WHERE "orderId" = p_order_id
    AND "status" = 'paid';


    IF v_paid < v_order."total" THEN
        RAISE EXCEPTION
            'Insufficient payment. Required: %, paid: %',
            v_order."total",
            v_paid;
    END IF;


    PERFORM public.process_order_inventory(
        p_order_id
    );


    IF v_order."cashSessionId" IS NOT NULL THEN

        FOR v_payment IN
            SELECT *
            FROM public."payments"
            WHERE "orderId" = p_order_id
            AND "status" = 'paid'
            AND "method" = 'cash'
        LOOP

            INSERT INTO public."cashMovements" (
                "cashSessionId",
                "type",
                "amount",
                "referenceType",
                "referenceId",
                "description",
                "createdById"
            )
            VALUES (
                v_order."cashSessionId",
                'sale',
                v_payment."amount",
                'order',
                p_order_id,
                'Cash payment from sale',
                v_payment."createdById"
            );

        END LOOP;

    END IF;


    UPDATE public."orders"
    SET
        "status" = 'completed',
        "completedAt" = NOW()
    WHERE "id" = p_order_id;


    INSERT INTO public."tickets" (
        "orderId"
    )
    VALUES (
        p_order_id
    )
    ON CONFLICT ("orderId")
    DO NOTHING;

END;
$$;


-- ============================================================
-- 21. DASHBOARD - STOCK BAJO
-- ============================================================

DROP VIEW IF EXISTS public."lowStockIngredients";

CREATE VIEW public."lowStockIngredients" AS
SELECT
    i."id",
    i."name",
    i."sku",
    i."currentStock",
    i."minimumStock",
    u."name" AS "unitName",
    u."abbreviation" AS "unitAbbreviation"
FROM public."ingredients" i
INNER JOIN public."inventoryUnits" u
    ON u."id" = i."unitId"
WHERE
    i."isActive" = true
    AND i."currentStock" <= i."minimumStock";


-- ============================================================
-- 22. DASHBOARD - VENTAS DIARIAS
-- ============================================================

DROP VIEW IF EXISTS public."dashboardDailySales";

CREATE VIEW public."dashboardDailySales" AS
SELECT
    DATE_TRUNC(
        'day',
        o."completedAt"
    ) AS "date",

    COUNT(o."id") AS "orders",

    COALESCE(
        SUM(o."subtotal"),
        0
    ) AS "subtotal",

    COALESCE(
        SUM(o."discount"),
        0
    ) AS "discount",

    COALESCE(
        SUM(o."tax"),
        0
    ) AS "tax",

    COALESCE(
        SUM(o."total"),
        0
    ) AS "total"

FROM public."orders" o

WHERE
    o."status" = 'completed'

GROUP BY
    DATE_TRUNC(
        'day',
        o."completedAt"
    )

ORDER BY
    "date" DESC;


-- ============================================================
-- 23. DASHBOARD - MÉTODOS DE PAGO
-- ============================================================

DROP VIEW IF EXISTS public."dashboardPaymentMethods";

CREATE VIEW public."dashboardPaymentMethods" AS
SELECT
    p."method",

    COUNT(*) AS "payments",

    COALESCE(
        SUM(p."amount"),
        0
    ) AS "total"

FROM public."payments" p

INNER JOIN public."orders" o
    ON o."id" = p."orderId"

WHERE
    p."status" = 'paid'
    AND o."status" = 'completed'

GROUP BY
    p."method"

ORDER BY
    "total" DESC;


-- ============================================================
-- 24. DASHBOARD - PRODUCTOS MÁS VENDIDOS
-- ============================================================

DROP VIEW IF EXISTS public."dashboardTopProducts";

CREATE VIEW public."dashboardTopProducts" AS
SELECT
    COALESCE(
        oi."productId",
        oi."comboId"
    ) AS "itemId",

    CASE
        WHEN oi."comboId" IS NOT NULL
            THEN 'combo'
        ELSE 'product'
    END AS "itemType",

    oi."productName",

    SUM(oi."quantity") AS "quantitySold",

    COALESCE(
        SUM(oi."subtotal"),
        0
    ) AS "sales"

FROM public."orderItems" oi

INNER JOIN public."orders" o
    ON o."id" = oi."orderId"

WHERE
    o."status" = 'completed'

GROUP BY
    COALESCE(
        oi."productId",
        oi."comboId"
    ),
    CASE
        WHEN oi."comboId" IS NOT NULL
            THEN 'combo'
        ELSE 'product'
    END,
    oi."productName"

ORDER BY
    "quantitySold" DESC;


-- ============================================================
-- 25. DASHBOARD - EXTRAS
-- ============================================================

DROP VIEW IF EXISTS public."dashboardTopExtras";

CREATE VIEW public."dashboardTopExtras" AS
SELECT
    oe."extraId",

    oe."extraName",

    SUM(oe."quantity") AS "quantitySold",

    COALESCE(
        SUM(oe."subtotal"),
        0
    ) AS "sales"

FROM public."orderItemExtras" oe

INNER JOIN public."orderItems" oi
    ON oi."id" = oe."orderItemId"

INNER JOIN public."orders" o
    ON o."id" = oi."orderId"

WHERE
    o."status" = 'completed'

GROUP BY
    oe."extraId",
    oe."extraName"

ORDER BY
    "quantitySold" DESC;


-- ============================================================
-- 26. DASHBOARD - GASTOS
-- ============================================================

DROP VIEW IF EXISTS public."dashboardExpenses";

CREATE VIEW public."dashboardExpenses" AS
SELECT
    e."category",

    COUNT(*) AS "expenses",

    COALESCE(
        SUM(e."amount"),
        0
    ) AS "total"

FROM public."expenses" e

GROUP BY
    e."category"

ORDER BY
    "total" DESC;


-- ============================================================
-- 27. DASHBOARD - VENTAS POR HORA
-- ============================================================

DROP VIEW IF EXISTS public."dashboardSalesByHour";

CREATE VIEW public."dashboardSalesByHour" AS
SELECT
    EXTRACT(
        HOUR FROM o."completedAt"
    )::integer AS "hour",

    COUNT(*) AS "orders",

    COALESCE(
        SUM(o."total"),
        0
    ) AS "total"

FROM public."orders" o

WHERE
    o."status" = 'completed'

GROUP BY
    EXTRACT(
        HOUR FROM o."completedAt"
    )

ORDER BY
    "hour";


-- ============================================================
-- 28. DASHBOARD - UTILIDAD
-- ============================================================

DROP VIEW IF EXISTS public."dashboardProfit";

CREATE VIEW public."dashboardProfit" AS
WITH item_costs AS (

    SELECT
        oi."orderId",

        SUM(
            oi."quantity"
            * oi."costSnapshot"
        ) AS "productCost"

    FROM public."orderItems" oi

    GROUP BY
        oi."orderId"
),

extra_costs AS (

    SELECT
        oi."orderId",

        SUM(
            oe."quantity"
            * oe."costSnapshot"
        ) AS "extraCost"

    FROM public."orderItemExtras" oe

    INNER JOIN public."orderItems" oi
        ON oi."id" = oe."orderItemId"

    GROUP BY
        oi."orderId"
)

SELECT
    DATE_TRUNC(
        'day',
        o."completedAt"
    ) AS "date",

    COALESCE(
        SUM(o."total"),
        0
    ) AS "sales",

    COALESCE(
        SUM(ic."productCost"),
        0
    )
    +
    COALESCE(
        SUM(ec."extraCost"),
        0
    ) AS "estimatedCost",

    COALESCE(
        SUM(o."total"),
        0
    )
    -
    (
        COALESCE(
            SUM(ic."productCost"),
            0
        )
        +
        COALESCE(
            SUM(ec."extraCost"),
            0
        )
    ) AS "estimatedProfit"

FROM public."orders" o

LEFT JOIN item_costs ic
    ON ic."orderId" = o."id"

LEFT JOIN extra_costs ec
    ON ec."orderId" = o."id"

WHERE
    o."status" = 'completed'

GROUP BY
    DATE_TRUNC(
        'day',
        o."completedAt"
    )

ORDER BY
    "date" DESC;


-- ============================================================
-- 29. DASHBOARD - RESUMEN
-- ============================================================

DROP VIEW IF EXISTS public."dashboardSummary";

CREATE VIEW public."dashboardSummary" AS
WITH item_costs AS (

    SELECT
        oi."orderId",

        SUM(
            oi."quantity"
            * oi."costSnapshot"
        ) AS "productCost"

    FROM public."orderItems" oi

    GROUP BY
        oi."orderId"
),

extra_costs AS (

    SELECT
        oi."orderId",

        SUM(
            oe."quantity"
            * oe."costSnapshot"
        ) AS "extraCost"

    FROM public."orderItemExtras" oe

    INNER JOIN public."orderItems" oi
        ON oi."id" = oe."orderItemId"

    GROUP BY
        oi."orderId"
),

order_costs AS (

    SELECT
        o."id" AS "orderId",

        o."total",

        COALESCE(
            ic."productCost",
            0
        )
        +
        COALESCE(
            ec."extraCost",
            0
        ) AS "cost"

    FROM public."orders" o

    LEFT JOIN item_costs ic
        ON ic."orderId" = o."id"

    LEFT JOIN extra_costs ec
        ON ec."orderId" = o."id"

    WHERE
        o."status" = 'completed'
)

SELECT

    COUNT(*) AS "totalOrders",

    COALESCE(
        SUM("total"),
        0
    ) AS "totalSales",

    COALESCE(
        AVG("total"),
        0
    ) AS "averageTicket",

    COALESCE(
        SUM("cost"),
        0
    ) AS "estimatedCost",

    COALESCE(
        SUM(
            "total" - "cost"
        ),
        0
    ) AS "estimatedProfit"

FROM order_costs;


-- ============================================================
-- FIN DE MIGRACIÓN
-- ============================================================