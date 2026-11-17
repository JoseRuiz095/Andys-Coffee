/**
 * Opening stock from the business inventory sheet (May 2026): the "Stock Inicial" and
 * "Stock Minimo" columns, as written in the sheet (its unit, not converted). Loaded with
 * `scripts/load-opening-stock.ts`, which converts each row to the ingredient's base unit with
 * `toBaseQuantity` and only touches ingredients that have no stock and no movements yet.
 *
 * Transcription notes:
 *  - Sheet IDs are not used (PROD-086 and PROD-087 are repeated, "PR0D-109" has a typo):
 *    rows are matched by ingredient name, accents and case ignored.
 *  - The dated columns (03/05–20/05/2026) are not loaded: they have #REF!, blanks and jumps
 *    of three orders of magnitude.
 *  - Disposables and sachets the sheet lists in grams are weighed (too many to count), so
 *    they are stocked in gr. The four a recipe consumes by the piece stay in pz and are
 *    converted with PIECE_WEIGHT_GRAMS.
 *  - Blank cells (Limon eureka, Concentrado de limón) are null: nothing is loaded.
 */
import type { BaseUnit } from './ingredient-catalog';

export type SheetUnit = 'g' | 'kg' | 'ml' | 'L' | 'pieza' | 'bote' | 'paquete' | 'Suficiente?';

export interface OpeningStockEntry {
  name: string;
  sheetUnit: SheetUnit;
  stock: number | null;
  minimum: number | null;
}

export const OPENING_STOCK_SOURCE = 'Hoja de inventario, columna "Stock Inicial" (mayo 2026)';

export const OPENING_STOCK: OpeningStockEntry[] = [
  // Cafetería
  { name: 'Café entero', sheetUnit: 'g', stock: 1800, minimum: 1000 },
  { name: 'Café molido', sheetUnit: 'g', stock: 903, minimum: 300 },
  { name: 'Cajeta', sheetUnit: 'g', stock: 325, minimum: 100 },
  { name: 'Canela', sheetUnit: 'g', stock: 350, minimum: 0.2 },
  { name: 'Chai Guayaba', sheetUnit: 'g', stock: 236, minimum: 150 },
  { name: 'Chai Vainilla', sheetUnit: 'g', stock: 820, minimum: 150 },
  { name: 'Crema de biscoff', sheetUnit: 'g', stock: 0, minimum: 100 },
  { name: 'Endulzante', sheetUnit: 'ml', stock: 1000, minimum: 200 },
  { name: 'Hersheys', sheetUnit: 'g', stock: 448, minimum: 100 },
  { name: 'Leche condensada', sheetUnit: 'g', stock: 443, minimum: 250 },
  { name: 'Syrup Vainilla', sheetUnit: 'g', stock: 360, minimum: 200 },
  { name: 'French Vainilla', sheetUnit: 'g', stock: 422, minimum: 200 },
  { name: 'Caramel Machiato', sheetUnit: 'g', stock: 384, minimum: 250 },
  { name: 'Caramelo', sheetUnit: 'kg', stock: 0, minimum: 2.5 },
  { name: 'Flan', sheetUnit: 'pieza', stock: 0, minimum: 1 },

  // Congelados
  { name: 'Galletas', sheetUnit: 'pieza', stock: 16, minimum: 10 },
  { name: 'Papa Hashbrown', sheetUnit: 'pieza', stock: 4, minimum: 5 },
  { name: 'Papas a la francesa', sheetUnit: 'kg', stock: 1.6, minimum: 0.7 },
  { name: 'Nieve', sheetUnit: 'g', stock: 282, minimum: 50 },

  // Desechables
  { name: 'Bandeja transportadora café', sheetUnit: 'pieza', stock: 8, minimum: 5 },
  { name: 'Batidor para café', sheetUnit: 'g', stock: 445, minimum: 50 },
  { name: 'Bolsa camiseta amarilla', sheetUnit: 'g', stock: 179, minimum: 50 },
  { name: 'Bolsa celofan para cubiertos', sheetUnit: 'g', stock: 15, minimum: 10 },
  { name: 'Contenedor negro', sheetUnit: 'pieza', stock: 6, minimum: 10 },
  { name: 'Contenedor transparente', sheetUnit: 'pieza', stock: 17, minimum: 5 },
  { name: 'Cuchillo', sheetUnit: 'pieza', stock: 0, minimum: 50 },
  { name: 'Fajo de carton', sheetUnit: 'g', stock: 440, minimum: 50 },
  { name: 'Papel decorativo', sheetUnit: 'g', stock: 180, minimum: 40 },
  { name: 'Popotes', sheetUnit: 'g', stock: 180, minimum: 30 },
  { name: 'Servilletas', sheetUnit: 'g', stock: 233, minimum: 100 },
  { name: 'Tapa contenedor negro', sheetUnit: 'pieza', stock: 7, minimum: 10 },
  { name: 'Contenedor carton', sheetUnit: 'pieza', stock: 9, minimum: 10 },
  { name: 'Tapa contenedor carton', sheetUnit: 'pieza', stock: 8, minimum: 10 },
  { name: 'Vaso chico con tapa', sheetUnit: 'pieza', stock: 25, minimum: 10 },
  { name: 'Vaso mini con tapa', sheetUnit: 'g', stock: 77, minimum: 50 },
  { name: 'Vaso espresso con tapa', sheetUnit: 'pieza', stock: 152, minimum: 30 },
  { name: 'Tapa vaso caliente', sheetUnit: 'g', stock: 160, minimum: 40 },
  { name: 'Tapa vaso frio', sheetUnit: 'pieza', stock: 83, minimum: 10 },
  { name: 'Tenedores', sheetUnit: 'pieza', stock: 0, minimum: 50 },
  { name: 'Vaso café caliente', sheetUnit: 'g', stock: 772, minimum: 180 },
  { name: 'Vaso café frio', sheetUnit: 'pieza', stock: 47, minimum: 10 },
  { name: 'Sello para café', sheetUnit: 'g', stock: 37, minimum: 15 },
  { name: 'Sticker ANDYS', sheetUnit: 'pieza', stock: 105, minimum: 10 },
  { name: 'Sticker REDONDO', sheetUnit: 'pieza', stock: 144, minimum: 15 },

  // Lácteos
  { name: 'Crema lala', sheetUnit: 'g', stock: 0, minimum: 300 },
  { name: 'Crema para batir', sheetUnit: 'g', stock: 525, minimum: 200 },
  { name: 'Leche deslactosada', sheetUnit: 'L', stock: 2.7, minimum: 2 },
  { name: 'Manteca', sheetUnit: 'g', stock: 910, minimum: 300 },
  { name: 'Mantequilla', sheetUnit: 'g', stock: 118, minimum: 30 },
  { name: 'Queso Fresco', sheetUnit: 'g', stock: 130, minimum: 70 },
  { name: 'Mezcla de quesos', sheetUnit: 'g', stock: 340, minimum: 200 },
  { name: 'Queso philadelphia', sheetUnit: 'g', stock: 319, minimum: 200 },
  { name: 'Queso Amarillo', sheetUnit: 'g', stock: 4, minimum: 90 },
  { name: 'Mayonesa', sheetUnit: 'g', stock: 0, minimum: 300 },

  // Panadería
  { name: 'Azucar', sheetUnit: 'g', stock: 977, minimum: 500 },
  { name: 'Azucar Mascabado', sheetUnit: 'g', stock: 0, minimum: 100 },
  { name: 'Bagels', sheetUnit: 'pieza', stock: 0, minimum: 5 },
  { name: 'Mini bagel', sheetUnit: 'pieza', stock: 15, minimum: 4 },
  { name: 'Bagel congelado', sheetUnit: 'pieza', stock: 6, minimum: 2 },
  { name: 'Chispas chocolate', sheetUnit: 'g', stock: 431, minimum: 200 },
  { name: 'Croissants', sheetUnit: 'pieza', stock: 2, minimum: 2 },
  { name: 'Harina', sheetUnit: 'g', stock: 251, minimum: 500 },
  { name: 'Nuez molida', sheetUnit: 'g', stock: 0, minimum: 100 },
  { name: 'Totopos', sheetUnit: 'g', stock: 1310, minimum: 500 },
  { name: 'Polvo para hornear', sheetUnit: 'g', stock: 61, minimum: 20 },
  { name: 'Maizena', sheetUnit: 'g', stock: 135, minimum: 60 },
  { name: 'Miel mapple', sheetUnit: 'g', stock: 250, minimum: 150 },
  { name: 'Pan blanco', sheetUnit: 'pieza', stock: 12, minimum: 4 },

  // Preparados
  { name: 'Salsa verde', sheetUnit: 'L', stock: 1.5, minimum: 1 },
  { name: 'Salsa roja', sheetUnit: 'L', stock: 1, minimum: 0.5 },
  { name: 'Bote chipotle', sheetUnit: 'pieza', stock: 1, minimum: 5 },
  { name: 'Bote jalapeño', sheetUnit: 'pieza', stock: 11, minimum: 5 },
  { name: 'Bote cebolla', sheetUnit: 'pieza', stock: 7, minimum: 4 },
  { name: 'Cubiertos (tenedor)', sheetUnit: 'pieza', stock: 5, minimum: 10 },
  { name: 'Cubiertos (tenedor, cuchillo)', sheetUnit: 'pieza', stock: 15, minimum: 6 },
  { name: 'Masa waffles', sheetUnit: 'L', stock: 0.5, minimum: 1 },
  { name: 'Bote mantequilla', sheetUnit: 'bote', stock: 6, minimum: 5 },
  { name: 'Bote lechera', sheetUnit: 'pieza', stock: 6, minimum: 3 },
  { name: 'Waffles', sheetUnit: 'pieza', stock: 5, minimum: 0 },
  { name: 'Aderezo chipotle', sheetUnit: 'g', stock: 70, minimum: 500 },
  { name: 'Pan frances', sheetUnit: 'pieza', stock: 0, minimum: 0 },
  { name: 'Ensalada', sheetUnit: 'pieza', stock: 0, minimum: 0 },
  { name: 'Vinagreta', sheetUnit: 'pieza', stock: 0, minimum: 3 },
  { name: 'Bote mapple', sheetUnit: 'pieza', stock: 8, minimum: 3 },
  { name: 'Concentrado de limón', sheetUnit: 'ml', stock: null, minimum: null },

  // Proteínas
  { name: 'Arrachera', sheetUnit: 'g', stock: 1035, minimum: 400 },
  { name: 'Huevo', sheetUnit: 'pieza', stock: 0, minimum: 15 },
  { name: 'Pollo', sheetUnit: 'g', stock: 1690, minimum: 500 },
  { name: 'Tocino', sheetUnit: 'g', stock: 840, minimum: 300 },
  { name: 'Jamon', sheetUnit: 'g', stock: 243, minimum: 100 },

  // Sazonadores
  { name: 'Extracto Vainilla', sheetUnit: 'ml', stock: 50, minimum: 30 },
  { name: 'Knorr suiza pollo', sheetUnit: 'g', stock: 0, minimum: 40 },
  { name: 'Pimienta', sheetUnit: 'g', stock: 275, minimum: 50 },
  { name: 'Sal', sheetUnit: 'g', stock: 1353, minimum: 50 },

  // Varios
  { name: 'Aceite para freir', sheetUnit: 'Suficiente?', stock: 1, minimum: 0 },
  { name: 'Agua', sheetUnit: 'ml', stock: 1500, minimum: 10000 },
  { name: 'Hielo', sheetUnit: 'g', stock: 1, minimum: 1000 },
  { name: 'Sobrecito azucar', sheetUnit: 'g', stock: 0, minimum: 50 },
  { name: 'Sobrecito catsup', sheetUnit: 'g', stock: 1881, minimum: 100 },
  { name: 'Sobrecito crema en polvo', sheetUnit: 'g', stock: 80, minimum: 35 },
  { name: 'Ajo en polvo', sheetUnit: 'g', stock: 140, minimum: 35 },

  // Verdura
  { name: 'Aguacate', sheetUnit: 'pieza', stock: 1, minimum: 2 },
  { name: 'Ajo', sheetUnit: 'g', stock: 0, minimum: 50 },
  { name: 'Calabacita', sheetUnit: 'g', stock: 0, minimum: 4 },
  { name: 'Cebolla', sheetUnit: 'kg', stock: 0.36, minimum: 0.36 },
  { name: 'Chile chipotle', sheetUnit: 'g', stock: 78, minimum: 50 },
  { name: 'Chile serrano', sheetUnit: 'pieza', stock: 0, minimum: 2 },
  { name: 'Cilantro', sheetUnit: 'g', stock: 80, minimum: 50 },
  { name: 'Jalapeño curtido', sheetUnit: 'paquete', stock: 0.75, minimum: 0.25 },
  { name: 'Lechuga', sheetUnit: 'g', stock: 400, minimum: 100 },
  { name: 'Pepino', sheetUnit: 'pieza', stock: 1.5, minimum: 1.5 },
  { name: 'Tomate cherry', sheetUnit: 'g', stock: 0, minimum: 50 },
  { name: 'Jitomate', sheetUnit: 'kg', stock: 0.227, minimum: 0.5 },
  { name: 'Tomate verde', sheetUnit: 'kg', stock: 0.513, minimum: 0.3 },
  { name: 'Desinfectante', sheetUnit: 'g', stock: 21.6, minimum: 15 },
  { name: 'Chile Guajillo', sheetUnit: 'pieza', stock: 0, minimum: 1 },
  { name: 'Limon eureka', sheetUnit: 'g', stock: null, minimum: null },
];

/**
 * Weight of one piece, in grams, for ingredients stocked by the piece that the sheet weighs
 * (or the other way round: Aguacate is stocked in gr and the sheet counts pieces). null =
 * not known yet: the row is not loaded until the business gives the weight.
 */
export const PIECE_WEIGHT_GRAMS: Record<string, number | null> = {
  'Vaso café caliente': null,
  'Tapa vaso caliente': null,
  'Fajo de carton': null,
  'Papel decorativo': null,
  Aguacate: null,
};

/**
 * Syrups are stocked in ml (recipes measure them in ml) but the sheet weighs them: loaded as
 * 1 gr = 1 ml (approximation; a physical count corrects it).
 */
export const GRAMS_AS_MILLILITERS = new Set(['Syrup Vainilla', 'French Vainilla', 'Caramel Machiato', 'Miel mapple']);

const SHEET_UNITS: Record<SheetUnit, { base: BaseUnit; factor: number } | null> = {
  g: { base: 'gr', factor: 1 },
  kg: { base: 'gr', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  L: { base: 'ml', factor: 1000 },
  pieza: { base: 'pz', factor: 1 },
  bote: { base: 'pz', factor: 1 },
  paquete: { base: 'pz', factor: 1 },
  'Suficiente?': null,
};

export type Conversion = { ok: true; value: number; note?: string } | { ok: false; reason: string };

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

/** Converts a sheet value to the ingredient's base unit (`target`). */
export function toBaseQuantity(entry: Pick<OpeningStockEntry, 'name' | 'sheetUnit'>, value: number, target: BaseUnit): Conversion {
  const unit = SHEET_UNITS[entry.sheetUnit];
  if (!unit) return { ok: false, reason: `la hoja no dice la unidad ("${entry.sheetUnit}")` };
  const base = round4(value * unit.factor);
  if (unit.base === target) return { ok: true, value: base };

  if (unit.base === 'gr' && target === 'ml' && GRAMS_AS_MILLILITERS.has(entry.name)) {
    return { ok: true, value: base, note: 'pesado en gr, cargado como 1 gr = 1 ml' };
  }
  if (entry.name in PIECE_WEIGHT_GRAMS && ((unit.base === 'gr' && target === 'pz') || (unit.base === 'pz' && target === 'gr'))) {
    const weight = PIECE_WEIGHT_GRAMS[entry.name];
    if (!weight) return { ok: false, reason: `falta el peso de una pieza (PIECE_WEIGHT_GRAMS en prisma/opening-stock.ts)` };
    return target === 'pz'
      ? { ok: true, value: Math.round(base / weight), note: `${base} gr ÷ ${weight} gr por pieza` }
      : { ok: true, value: round4(base * weight), note: `${base} pz × ${weight} gr por pieza` };
  }
  return { ok: false, reason: `la hoja está en ${entry.sheetUnit} y el insumo en ${target}` };
}
