import cron from 'node-cron';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { CASH_TIMEZONE } from '../config/app';
import { logger } from '../utils/logger';
import { NotificationService } from '../services/notification.service';
import { UserRepository } from '../repositories/user.repository';
import { getTodayInZone, getZonedDayBoundaries } from '../utils/businessDate';

interface ReconciliationResult {
  sessionId: string;
  cashRegisterName: string;
  expectedAmount: Prisma.Decimal;
  actualSum: Prisma.Decimal;
  discrepancy: Prisma.Decimal;
  isValid: boolean;
}

/**
 * Daily reconciliation job that validates each closed cash session's expectedAmount
 * against the actual sum of CashMovement records. Runs at 23:30 by default.
 */
export function scheduleCashReconciliation() {
  if (process.env.ENABLE_CASH_RECONCILIATION === 'false') {
    logger.info('Cash reconciliation scheduler disabled via ENABLE_CASH_RECONCILIATION=false');
    return;
  }

  cron.schedule(
    '30 23 * * *',
    async () => {
      try {
        const today = getTodayInZone();
        const results = await reconcileAllSessions(today);

        if (results.length === 0) {
          logger.info({ date: today }, 'Cash reconciliation: no closed sessions found');
          return;
        }

        const failures = results.filter((r) => !r.isValid);
        if (failures.length === 0) {
          logger.info({ date: today, count: results.length }, 'Cash reconciliation: all sessions valid');
          return;
        }

        logger.warn({ date: today, failures: failures.length, total: results.length }, 'Cash reconciliation found discrepancies');

        // Notify admins about discrepancies
        const admins = await UserRepository.findActiveByRoleNames(['ADMIN']);
        if (admins.length > 0) {
          const failureDetails = failures
            .map((f) => `${f.cashRegisterName}: esperado $${f.expectedAmount.toString()} vs suma $${f.actualSum.toString()}`)
            .join('\n');

          await NotificationService.createNotification(
            {
              title: `⚠️ Discrepancia en reconciliación de caja (${today})`,
              message: `Se encontraron ${failures.length} sesión(es) con discrepancia:\n${failureDetails}`,
              type: 'GENERAL',
            },
            admins.map((a) => a.id),
          );
        }
      } catch (err) {
        logger.error({ err }, 'Cash reconciliation job failed');
      }
    },
    { timezone: CASH_TIMEZONE },
  );

  logger.info('Cash reconciliation scheduler started (daily 23:30, timezone ' + CASH_TIMEZONE + ')');
}

async function reconcileAllSessions(dateStr: string): Promise<ReconciliationResult[]> {
  const { start, end } = getZonedDayBoundaries(dateStr);

  // Find all closed sessions for the day
  const sessions = await prisma.cashSession.findMany({
    where: {
      openedAt: { gte: start, lt: end },
      status: 'closed',
    },
    include: { cashRegister: true },
  });

  const results: ReconciliationResult[] = [];

  for (const session of sessions) {
    const movements = await prisma.cashMovement.findMany({
      where: { cashSessionId: session.id },
    });

    const actualSum = movements.reduce((sum, m) => sum.plus(m.amount), new Prisma.Decimal(0));
    const discrepancy = actualSum.minus(session.expectedAmount);
    const isValid = discrepancy.isZero();

    results.push({
      sessionId: session.id,
      cashRegisterName: session.cashRegister.name,
      expectedAmount: session.expectedAmount,
      actualSum,
      discrepancy,
      isValid,
    });
  }

  return results;
}
