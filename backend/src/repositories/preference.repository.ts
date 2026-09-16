import { prisma } from '../config/prisma';

export const PreferenceRepository = {
  async findAll() {
    return prisma.systemPreference.findMany({
      orderBy: { key: 'asc' },
    });
  },

  async findByKey(key: string) {
    return prisma.systemPreference.findUnique({
      where: { key },
    });
  },

  async upsert(key: string, value: string, type: string = 'string', label?: string, description?: string) {
    return prisma.systemPreference.upsert({
      where: { key },
      update: { value, type, label, description },
      create: { key, value, type, label, description },
    });
  },

  async delete(key: string) {
    return prisma.systemPreference.delete({
      where: { key },
    });
  },
};
