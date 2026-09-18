import { prisma } from '../config/prisma';
import type { GeneralPreferencesInput } from '../validators/preference.validator';

const GENERAL_PREFERENCE_KEYS = {
  businessName: 'general.business_name',
  businessHoursOpen: 'general.business_hours_open',
  businessHoursClose: 'general.business_hours_close',
  currency: 'general.currency',
  currencySymbol: 'general.currency_symbol',
  phone: 'general.phone',
  address: 'general.address',
};

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

  async getGeneralPreferences(): Promise<GeneralPreferencesInput> {
    const prefs = await prisma.systemPreference.findMany({
      where: {
        key: { startsWith: 'general.' },
      },
    });

    const prefMap = Object.fromEntries(prefs.map((p) => [p.key, p.value]));

    // Return with defaults if not configured
    return {
      businessName: (prefMap[GENERAL_PREFERENCE_KEYS.businessName] ?? "Andy's Coffee") as string,
      businessHoursOpen: (prefMap[GENERAL_PREFERENCE_KEYS.businessHoursOpen] ?? '09:00') as string,
      businessHoursClose: (prefMap[GENERAL_PREFERENCE_KEYS.businessHoursClose] ?? '22:00') as string,
      currency: ((prefMap[GENERAL_PREFERENCE_KEYS.currency] ?? 'MXN') as 'MXN' | 'USD' | 'CAD'),
      currencySymbol: (prefMap[GENERAL_PREFERENCE_KEYS.currencySymbol] ?? '$') as string,
      phone: (prefMap[GENERAL_PREFERENCE_KEYS.phone] ?? '') as string,
      address: (prefMap[GENERAL_PREFERENCE_KEYS.address] ?? '') as string,
    };
  },

  async upsertGeneralPreferences(input: GeneralPreferencesInput) {
    const updates = [
      this.upsert(GENERAL_PREFERENCE_KEYS.businessName, input.businessName, 'string'),
      this.upsert(GENERAL_PREFERENCE_KEYS.businessHoursOpen, input.businessHoursOpen, 'string'),
      this.upsert(GENERAL_PREFERENCE_KEYS.businessHoursClose, input.businessHoursClose, 'string'),
      this.upsert(GENERAL_PREFERENCE_KEYS.currency, input.currency, 'string'),
      this.upsert(GENERAL_PREFERENCE_KEYS.currencySymbol, input.currencySymbol, 'string'),
      ...(input.phone ? [this.upsert(GENERAL_PREFERENCE_KEYS.phone, input.phone, 'string')] : []),
      ...(input.address ? [this.upsert(GENERAL_PREFERENCE_KEYS.address, input.address, 'string')] : []),
    ];

    await Promise.all(updates);
    return this.getGeneralPreferences();
  },
};
