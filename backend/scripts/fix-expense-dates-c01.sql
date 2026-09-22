-- Corrección de datos para el hallazgo C-01 (docs/auditoria-mvp-2026-09-22.md).
--
-- Antes de la corrección, todo gasto creado o editado con una fecha explícita se guardaba
-- a las 12:00:00 UTC = 06:00 en America/Mexico_City, antes de la apertura del negocio, y el
-- estado de resultados lo descartaba. Este script mueve esos gastos a la mitad del horario
-- de negocio configurado (por defecto 09:00–22:00 → 15:30 local = 21:30 UTC), igual que
-- hace ahora ExpenseService para fechas pasadas.
--
-- NO se ejecuta automáticamente. Revisar primero el SELECT, ajustar la hora si el horario
-- de negocio es otro, y correrlo dentro de una transacción.

-- 1) Revisar qué gastos se verían afectados
SELECT id, category, description, amount, "expenseDate", "cashSessionId"
FROM expenses
WHERE ("expenseDate" AT TIME ZONE 'UTC')::time = '12:00:00'
ORDER BY "expenseDate";

-- 2) Corregir (misma fecha de negocio, 15:30 hora de Ciudad de México)
BEGIN;

UPDATE expenses
SET "expenseDate" = (
  (("expenseDate" AT TIME ZONE 'America/Mexico_City')::date + TIME '15:30')
  AT TIME ZONE 'America/Mexico_City'
)
WHERE ("expenseDate" AT TIME ZONE 'UTC')::time = '12:00:00';

-- 3) Los snapshots finales de esos días se calcularon sin estos gastos: se borran para
--    que el estado de resultados los recalcule en la siguiente consulta.
DELETE FROM income_statement_daily_snapshots
WHERE date IN (
  SELECT DISTINCT ("expenseDate" AT TIME ZONE 'America/Mexico_City')::date
  FROM expenses
  WHERE ("expenseDate" AT TIME ZONE 'America/Mexico_City')::time = '15:30:00'
);

COMMIT;
