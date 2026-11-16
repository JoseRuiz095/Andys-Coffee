/**
 * N-4 (2026-11-14): business, finance and inventory settings have their own permission. They
 * used to require users.update, so whoever managed users could also rewrite the distribution,
 * the fixed expenses, the accumulated balances and the inventory or general preferences.
 * Seeded (prisma/seed.ts) and granted to ADMIN; custom roles get it explicitly.
 */
export const SETTINGS_PERMISSION = 'settings.manage';
