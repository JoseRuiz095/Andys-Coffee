import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { TRANSACTION_MAX_WAIT_MS, TRANSACTION_TIMEOUT_MS } from '../config/app';

/** Transaction handle passed from services to repository methods. */
export type Tx = Prisma.TransactionClient;

/** Either the root client or a transaction: repository methods that can run in both accept this. */
export type DbClient = Tx | typeof prisma;

/**
 * Runs `work` in a database transaction. Services use this instead of prisma.$transaction so
 * they never touch Prisma directly (CLAUDE.md: Controllers → Services → Repositories → Prisma).
 * `serializable` is for flows with race conditions (cash, sales, inventory); a serialization
 * conflict surfaces as Prisma error P2034, mapped to 409 by the error handler.
 */
/** Serializable transactions that lost a race (P2034) are retried this many times in total. */
export const SERIALIZATION_ATTEMPTS = 10;

export function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

/**
 * Wait before retry `attempt` (0-based): exponential with random jitter (15–30 ms, 30–60 ms, …,
 * capped at 300–600 ms), so concurrent sales that collided on the same cash session don't collide
 * again in lockstep. Two immediate retries made 5 of 8 simultaneous sales fail with 409 (QA audit
 * 2026-11-18, D-01); the worst case now waits ≈ 3 s in total instead of failing.
 */
export function waitBeforeRetry(attempt: number): Promise<void> {
  const base = Math.min(15 * 2 ** attempt, 300);
  return new Promise((resolve) => setTimeout(resolve, base + Math.random() * base));
}

/**
 * Serializable transaction retried on P2034 with jittered backoff. Only for `work` whose effects
 * are all inside the transaction (a rolled-back attempt leaves nothing behind) and whose checks
 * are re-done inside it, so a retry of an already-applied change fails its own business rule.
 */
export async function runSerializableWithRetry<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await runInTransaction(work, { serializable: true });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt >= SERIALIZATION_ATTEMPTS - 1) throw error;
      await waitBeforeRetry(attempt);
    }
  }
}

export function runInTransaction<T>(work: (tx: Tx) => Promise<T>, options: { serializable?: boolean } = {}): Promise<T> {
  return prisma.$transaction(work, {
    maxWait: TRANSACTION_MAX_WAIT_MS,
    timeout: TRANSACTION_TIMEOUT_MS,
    ...(options.serializable && { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
  });
}
