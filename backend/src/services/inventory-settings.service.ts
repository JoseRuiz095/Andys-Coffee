import { AuditLogRepository } from '../repositories/audit-log.repository';
import { PreferenceRepository } from '../repositories/preference.repository';
import { AuthorizationError, ConflictError } from '../utils/errors';
import type { AuthUser } from './auth.service';
import { CONSUME_ON_SALE_KEY } from './inventory-consumption.service';
import { RecipeService } from './recipe.service';
import { LOW_STOCK_NOTIFY_KEY } from './stock-alert.service';
import { SETTINGS_PERMISSION } from '../config/permissions';

const SETTINGS = {
  consumeOnSale: {
    key: CONSUME_ON_SALE_KEY,
    label: 'Descontar inventario al vender',
    description: 'Cada venta descuenta los insumos de la receta de sus productos y extras.',
    defaultValue: false,
  },
  lowStockNotify: {
    key: LOW_STOCK_NOTIFY_KEY,
    label: 'Avisar stock bajo',
    description: 'Notifica cuando un insumo llega a su stock mínimo o se agota.',
    defaultValue: true,
  },
} as const;

type SettingName = keyof typeof SETTINGS;

async function readSetting(name: SettingName) {
  const preference = await PreferenceRepository.findByKey(SETTINGS[name].key);
  return preference ? preference.value === 'true' : SETTINGS[name].defaultValue;
}

/**
 * Inventory switches (system preferences under "inventory.", which the generic preferences
 * endpoint refuses). Turning consumption on requires every product to have its recipe.
 */
export const InventorySettingsService = {
  async get() {
    const [consumeOnSale, lowStockNotify] = await Promise.all([readSetting('consumeOnSale'), readSetting('lowStockNotify')]);
    return { consumeOnSale, lowStockNotify };
  },

  async update(input: Partial<Record<SettingName, boolean>>, user: AuthUser) {
    if (!user.permissions?.includes(SETTINGS_PERMISSION)) {
      throw new AuthorizationError('No tienes permiso para cambiar la configuración del inventario.');
    }

    if (input.consumeOnSale === true && !(await readSetting('consumeOnSale'))) {
      const missing = await RecipeService.findProductsMissingRecipe();
      if (missing.length > 0) {
        const names = missing.slice(0, 10).map((product) => product.name).join(', ');
        throw new ConflictError(
          `No se puede activar: ${missing.length} producto(s) sin receta (${names}${missing.length > 10 ? '…' : ''}). ` +
          'Captura sus recetas o márcalos como "No controla inventario".',
        );
      }
    }

    const before = await InventorySettingsService.get();
    for (const name of Object.keys(input) as SettingName[]) {
      const value = input[name];
      if (value === undefined) continue;
      const setting = SETTINGS[name];
      await PreferenceRepository.upsert(setting.key, String(value), 'boolean', setting.label, setting.description);
    }
    const after = await InventorySettingsService.get();
    await AuditLogRepository.create({ userId: user.id, action: 'INVENTORY_SETTINGS_CHANGED', metadata: { before, after } });
    return after;
  },
};
