import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { DbClient } from './transaction';

export const AuditLogRepository = {
  create(
    data: { userId: string; action: string; cashSessionId?: string; metadata: Prisma.InputJsonValue },
    client: DbClient = prisma,
  ) {
    return client.auditLog.create({ data });
  },
};
