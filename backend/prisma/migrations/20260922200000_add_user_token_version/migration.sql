-- M-06 (docs/auditoria-mvp-2026-09-22.md): session revocation.
-- Existing users start at 0, which is also the version assumed for tokens issued before
-- this change, so nobody is logged out by the migration itself.
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
