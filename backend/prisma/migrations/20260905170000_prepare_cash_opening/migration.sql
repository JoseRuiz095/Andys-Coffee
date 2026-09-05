DROP INDEX IF EXISTS "cash_sessions_cashRegisterId_key";
DROP INDEX IF EXISTS "cashSessions_one_open_per_register";

CREATE UNIQUE INDEX "cashSessions_one_open_per_register"
ON "cash_sessions"("cashRegisterId")
WHERE (status = 'open');

INSERT INTO "cash_registers" ("name", "description")
SELECT 'Caja principal', 'Caja principal de ventas'
WHERE NOT EXISTS (SELECT 1 FROM "cash_registers");