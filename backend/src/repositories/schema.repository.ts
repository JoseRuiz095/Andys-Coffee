import { prisma } from '../config/prisma';

export const SchemaRepository = {
  /** True when `migrationName` was applied completely (not failed, not rolled back). */
  async isMigrationApplied(migrationName: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<{ applied: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM "_prisma_migrations"
        WHERE migration_name = ${migrationName} AND finished_at IS NOT NULL AND rolled_back_at IS NULL
      ) AS applied`;
    return rows[0]?.applied === true;
  },
};
