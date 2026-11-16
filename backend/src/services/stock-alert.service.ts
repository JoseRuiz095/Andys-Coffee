import { PreferenceRepository } from '../repositories/preference.repository';
import { UserRepository } from '../repositories/user.repository';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';
import type { StockCrossing } from './inventory-consumption.service';

export const LOW_STOCK_NOTIFY_KEY = 'inventory.lowStockNotify';
/** Who restocks: users that can register purchases receive the alerts. */
const RECIPIENT_PERMISSION = 'inventory.create_entry';

const format = (value: { toDecimalPlaces(places: number): { toString(): string } }) => value.toDecimalPlaces(2).toString();

/**
 * Low-stock alerts (plan F6). Sent after the transaction that moved the stock commits, only for
 * the ingredients that crossed their minimum or ran out in that operation (never once per sale
 * while they stay low). A failure is logged and never undoes the operation.
 */
export const StockAlertService = {
  async notify(crossings: StockCrossing[], context: { requestId?: string } = {}) {
    if (crossings.length === 0) return;
    try {
      const preference = await PreferenceRepository.findByKey(LOW_STOCK_NOTIFY_KEY);
      if (preference?.value === 'false') return;
      const recipients = (await UserRepository.findActiveWithPermission(RECIPIENT_PERMISSION)).map(({ id }) => id);
      if (recipients.length === 0) return;

      for (const crossing of crossings) {
        const outOfStock = crossing.after.lte(0);
        await NotificationService.createNotification(
          {
            title: outOfStock ? `Insumo agotado: ${crossing.name}` : `Stock bajo: ${crossing.name}`,
            message: outOfStock
              ? `${crossing.name} quedó en ${format(crossing.after)} ${crossing.unit}. Registra una compra o un conteo físico.`
              : `${crossing.name} quedó en ${format(crossing.after)} ${crossing.unit} (mínimo ${format(crossing.minimumStock)} ${crossing.unit}).`,
            type: 'LOW_STOCK',
            referenceId: crossing.ingredientId,
          },
          recipients,
        );
      }
    } catch (error) {
      logger.error({ err: error, requestId: context.requestId }, 'Low-stock notification failed');
    }
  },
};
