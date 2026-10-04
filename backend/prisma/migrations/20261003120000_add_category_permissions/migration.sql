-- Category management permissions. categories.create/update were added to the seed after the
-- existing databases had been seeded (so ADMIN could not manage categories there);
-- categories.delete is new. Data-only and idempotent: safe on databases that already have them.
BEGIN;

INSERT INTO "permissions" ("id", "name", "description", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'categories.create', 'Crear categorías', now(), now()),
  (gen_random_uuid()::text, 'categories.update', 'Actualizar categorías', now(), now()),
  (gen_random_uuid()::text, 'categories.delete', 'Eliminar categorías', now(), now())
ON CONFLICT ("name") DO NOTHING;

-- ADMIN holds every permission (same rule as the seed).
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'ADMIN'
  AND p."name" IN ('categories.create', 'categories.update', 'categories.delete')
ON CONFLICT DO NOTHING;

COMMIT;
