import { incomeStatementRepository } from '../repositories/income-statement.repository';
import { logger } from '../utils/logger';

/**
 * F9 (2026-11-14): drops the frozen income-statement snapshots from `dateStr` on, AFTER the
 * operation committed. Best effort: if it fails, the operation already happened, so answering
 * 500 made the user retry something that was done (and get a confusing 409). It is logged
 * instead; the stale snapshot is fixed the next time any change invalidates that day.
 */
export async function invalidateSnapshotSafely(dateStr: string): Promise<void> {
  try {
    await incomeStatementRepository.invalidateSnapshot(dateStr);
  } catch (err) {
    logger.error({ err, date: dateStr }, 'No se pudo invalidar la foto del estado de resultados');
  }
}
