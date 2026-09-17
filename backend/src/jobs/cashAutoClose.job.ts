import cron from 'node-cron';
import { CashService } from '../services/cash.service';
import { UserRepository } from '../repositories/user.repository';
import { CASH_TIMEZONE } from '../config/app';
import { logger } from '../utils/logger';

/**
 * Polls every 15 minutes and force-closes the active cash session once the
 * business day has ended (see CashService.closeIfBusinessDayEnded), using an
 * active admin as the closing user for audit purposes. No-ops when there's
 * no open session, so re-running on every tick is safe.
 */
export function scheduleCashAutoClose() {
  if (process.env.ENABLE_CASH_AUTO_CLOSE === 'false') {
    logger.info('Cash auto-close scheduler disabled via ENABLE_CASH_AUTO_CLOSE=false');
    return;
  }

  cron.schedule(
    '*/15 * * * *',
    async () => {
      try {
        const [admin] = await UserRepository.findActiveByRoleNames(['ADMIN']);
        if (!admin) {
          logger.warn('Cash auto-close: no active ADMIN user found, skipping this tick.');
          return;
        }
        const closed = await CashService.closeIfBusinessDayEnded(admin.id);
        if (closed) {
          logger.info({ sessionId: closed.id }, 'Cash session auto-closed at business-day end');
        }
      } catch (err) {
        logger.error({ err }, 'Cash auto-close job failed');
      }
    },
    { timezone: CASH_TIMEZONE },
  );

  logger.info('Cash auto-close scheduler started (every 15 min, timezone ' + CASH_TIMEZONE + ')');
}
