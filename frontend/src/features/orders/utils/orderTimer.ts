import type { Order } from '../types/orders.types';

export type OrderSize = 'small' | 'medium' | 'large';
export type TimerLevel = 'ok' | 'warning' | 'late';

interface OrderSizeRule {
  size: OrderSize;
  label: string;
  /** Largest number of products (sum of quantities) that still counts as this size. */
  maxItems: number;
  /** Preparation target, counted from the moment the order was created. */
  targetMinutes: number;
}

const ORDER_SIZE_RULES: OrderSizeRule[] = [
  { size: 'small', label: 'Chica', maxItems: 3, targetMinutes: 5 },
  { size: 'medium', label: 'Mediana', maxItems: 7, targetMinutes: 10 },
  { size: 'large', label: 'Grande', maxItems: Infinity, targetMinutes: 15 },
];

/** Share of the target after which the timer turns from "on time" to "about to be late". */
const WARNING_RATIO = 0.7;

export const TIMER_LEVEL_COLOR: Record<TimerLevel, string> = {
  ok: 'var(--color-success)',
  warning: 'var(--color-warning)',
  late: 'var(--color-danger)',
};

/** Products in the order. Combos arrive already expanded into one item per product. */
export function getOrderItemCount(order: Order) {
  // Quantities are Prisma Decimals, serialized as strings by the API.
  return order.items.reduce((total, item) => total + Number(item.quantity), 0);
}

export function getOrderSizeRule(order: Order): OrderSizeRule {
  const itemCount = getOrderItemCount(order);
  return ORDER_SIZE_RULES.find((rule) => itemCount <= rule.maxItems) ?? ORDER_SIZE_RULES[ORDER_SIZE_RULES.length - 1];
}

/** Whole seconds since the order was created; never negative (client clock behind the server). */
export function getElapsedSeconds(createdAt: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
}

export function getTimerLevel(elapsedSeconds: number, targetMinutes: number): TimerLevel {
  const targetSeconds = targetMinutes * 60;
  if (elapsedSeconds > targetSeconds) return 'late';
  if (elapsedSeconds >= targetSeconds * WARNING_RATIO) return 'warning';
  return 'ok';
}

/** The timer only runs while the order is waiting for or in preparation. */
export function isOrderBeingPrepared(order: Order) {
  return order.status === 'pending' || order.status === 'preparing';
}

export function getOrderTimerLevel(order: Order, now: number): TimerLevel {
  return getTimerLevel(getElapsedSeconds(order.createdAt, now), getOrderSizeRule(order).targetMinutes);
}

/** MM:SS, or H:MM:SS once the order is over an hour old. */
export function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

const LEVEL_PRIORITY: Record<TimerLevel, number> = { late: 0, warning: 1, ok: 2 };

/**
 * Board order: late orders first, then the ones about to be late, then on time
 * (oldest first within each group); orders already ready go last.
 */
export function sortOrdersByUrgency(orders: Order[], now: number) {
  const priority = (order: Order) =>
    isOrderBeingPrepared(order) ? LEVEL_PRIORITY[getOrderTimerLevel(order, now)] : 3;

  return [...orders].sort(
    (a, b) => priority(a) - priority(b) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}
