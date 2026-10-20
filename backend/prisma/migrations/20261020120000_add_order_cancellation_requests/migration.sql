-- Cancellation requests for completed sales (approved or rejected by an admin), plus the
-- permission to approve them. Additive only: no existing table or column changes.
BEGIN;

CREATE TYPE "CancellationRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "order_cancellation_requests" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "orderId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CancellationRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMPTZ(6),
    "reviewComment" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_cancellation_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "orderCancellationRequests_order_idx" ON "order_cancellation_requests"("orderId");
CREATE INDEX "orderCancellationRequests_status_idx" ON "order_cancellation_requests"("status", "createdAt");
-- At most one pending request per order (partial index: not expressible in schema.prisma).
CREATE UNIQUE INDEX "orderCancellationRequests_one_pending" ON "order_cancellation_requests"("orderId") WHERE "status" = 'pending';

ALTER TABLE "order_cancellation_requests" ADD CONSTRAINT "order_cancellation_requests_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "order_cancellation_requests" ADD CONSTRAINT "order_cancellation_requests_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "order_cancellation_requests" ADD CONSTRAINT "order_cancellation_requests_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

INSERT INTO "permissions" ("id", "name", "description", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'sales.approve_cancellation', 'Aprobar cancelaciones de ventas completadas', now(), now())
ON CONFLICT ("name") DO NOTHING;

-- ADMIN holds every permission (same rule as the seed).
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'ADMIN' AND p."name" = 'sales.approve_cancellation'
ON CONFLICT DO NOTHING;

COMMIT;
