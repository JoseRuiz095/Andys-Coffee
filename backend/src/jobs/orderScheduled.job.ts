import cron from 'node-cron';
import { OrderService } from '../services/order.service';
import { logger } from '../utils/logger';

/**
 * Keeps the server authority for scheduled orders: it activates them when due and
 * emits one reminder per order while it is still in the 20-minute window before start.
 */
export function scheduleScheduledOrders() {
  cron.schedule('* * * * *', async () => {
    try {
      const activated = await OrderService.activateDueScheduledOrders();
      const reminded = await OrderService.notifyDueScheduledOrders();
      if (activated || reminded) {
        logger.info({ activated, reminded }, 'Scheduled-order automation tick completed');
      }
    } catch (error) {
      logger.error({ err: error }, 'Scheduled-order automation failed');
    }
  });

  logger.info('Scheduled-order automation started (every minute)');
}
