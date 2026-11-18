/**
 * Newest Prisma migration this code needs (the folder name in prisma/migrations). The image does
 * not ship the migrations, so this constant is how the running backend knows which schema it
 * expects; test/migrations-sync.test.ts fails when a new migration is added without updating it.
 * See docs/Project/deployment.md: production gets `prisma migrate deploy` BEFORE the new image.
 */
export const LATEST_REQUIRED_MIGRATION = "20261118120000_qa_audit_precision_and_normalized_keys";
