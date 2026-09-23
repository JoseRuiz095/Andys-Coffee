import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

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
export function runInTransaction<T>(work: (tx: Tx) => Promise<T>, options: { serializable?: boolean } = {}): Promise<T> {
  return prisma.$transaction(
    work,
    options.serializable ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } : undefined,
  );
}
