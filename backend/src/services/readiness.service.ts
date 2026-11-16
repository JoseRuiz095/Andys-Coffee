import { LATEST_REQUIRED_MIGRATION } from '../config/migrations';
import { SchemaRepository } from '../repositories/schema.repository';
import { logger } from '../utils/logger';

export interface Readiness {
  ready: boolean;
  /** 'ok' | 'schema-outdated' (a migration this code needs is missing) | 'database-unavailable'. */
  status: 'ok' | 'schema-outdated' | 'database-unavailable';
}

/**
 * Whether this backend can serve traffic: the database answers AND has every migration the code
 * needs. Deploying code before `prisma migrate deploy` used to stay "healthy" while the menu,
 * the POS and orders answered 500; pointing the platform's health check at /ready keeps the
 * previous version live instead.
 */
export const ReadinessService = {
  async check(): Promise<Readiness> {
    try {
      const applied = await SchemaRepository.isMigrationApplied(LATEST_REQUIRED_MIGRATION);
      return applied ? { ready: true, status: 'ok' } : { ready: false, status: 'schema-outdated' };
    } catch (err) {
      logger.error({ err }, 'Readiness check: database unavailable');
      return { ready: false, status: 'database-unavailable' };
    }
  },

  /** Logs loudly at startup when the schema is behind the code (the server still starts). */
  async warnIfSchemaOutdated(): Promise<void> {
    const { status } = await this.check();
    if (status === 'schema-outdated') {
      logger.error(
        { requiredMigration: LATEST_REQUIRED_MIGRATION },
        'La base de datos NO tiene todas las migraciones que necesita este código: ejecuta "prisma migrate deploy" (ver docs/Project/deployment.md). /ready responde 503 mientras tanto.',
      );
    }
  },
};
