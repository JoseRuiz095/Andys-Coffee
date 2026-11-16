/**
 * Business recipes (2026-11-16), from the cost sheet "Producto Venta / Consumo por receta".
 * Loaded with `scripts/load-recipes.ts` (preview by default, `--apply` to write).
 *
 * Quantities are per unit sold, in the ingredient's base unit (gr, ml, pz). Ingredients are
 * matched by name (accents and case ignored); products by SKU. Normalized from the sheet:
 *  - Espresso is not an ingredient: 1 shot = 12 gr Café molido + 60 ml Agua (2 shots in
 *    Latte Andy's and Coffee Cream).
 *  - Hielo in gr (the sheet said "pieza"); Leche "0.3 L" = 300 ml; Cebolla "0.03 kg" = 30 gr;
 *    Limón "10 kg" = 10 gr; cups, lids, "fajo" and decorative paper are 1 pz each (the sheet
 *    priced some of them by weight); Tomate rojo = Jitomate.
 *  - Products sold hot and cold have lines per temperature (HOT/COLD); BOTH lines apply to both.
 *  - Jumbo = Regular × 1.5 for food and drink (milk, syrups, coffee, water, ice), ×1 for
 *    packaging; the cup becomes the Jumbo cup (the lid is the same).
 */

export type Temperature = 'HOT' | 'COLD' | 'BOTH';

export interface RecipeCatalogLine {
  ingredient: string;
  quantity: number;
  temperature?: Temperature;
}

export interface RecipeCatalogEntry {
  sku: string;
  /** Name in the sheet, only for the report. */
  sheetName: string;
  /** Set the product's temperature (e.g. Chai, now sold hot and cold). */
  setTemperature?: 'HOT' | 'COLD' | 'BOTH';
  regular: RecipeCatalogLine[];
  /** Built by scaling the regular recipe (see jumboOf). */
  jumbo?: boolean;
}

/** New ingredients the recipes need (created with the next INS-### SKU, zero stock). */
export const NEW_INGREDIENTS: { name: string; unit: 'gr' | 'ml' | 'pz' }[] = [
  { name: 'Vaso café caliente Jumbo', unit: 'pz' },
  { name: 'Vaso café frio Jumbo', unit: 'pz' },
];

/** Packaging: not scaled in Jumbo. Cups are replaced by their Jumbo version. */
export const PACKAGING = new Set([
  'vaso cafe caliente', 'vaso cafe frio', 'tapa vaso caliente', 'tapa vaso frio', 'fajo de carton',
  'sticker andys', 'bandeja transportadora cafe', 'vaso espresso con tapa',
]);
export const JUMBO_CUP: Record<string, string> = {
  'vaso cafe caliente': 'Vaso café caliente Jumbo',
  'vaso cafe frio': 'Vaso café frio Jumbo',
};
export const JUMBO_FACTOR = 1.5;

const shot = (shots: number, temperature?: Temperature): RecipeCatalogLine[] => [
  { ingredient: 'Café molido', quantity: 12 * shots, temperature },
  { ingredient: 'Agua', quantity: 60 * shots, temperature },
];

/** Hot cup set: cup, lid and cardboard sleeve. */
const hotCup: RecipeCatalogLine[] = [
  { ingredient: 'Vaso café caliente', quantity: 1, temperature: 'HOT' },
  { ingredient: 'Tapa vaso caliente', quantity: 1, temperature: 'HOT' },
  { ingredient: 'Fajo de carton', quantity: 1, temperature: 'HOT' },
];
/** Cold cup set: cup, lid and 160 gr of ice. */
const coldCup = (ice = 160): RecipeCatalogLine[] => [
  { ingredient: 'Vaso café frio', quantity: 1, temperature: 'COLD' },
  { ingredient: 'Tapa vaso frio', quantity: 1, temperature: 'COLD' },
  { ingredient: 'Hielo', quantity: ice, temperature: 'COLD' },
];
const sticker = { ingredient: 'Sticker ANDYS', quantity: 1 };
const tray = { ingredient: 'Bandeja transportadora café', quantity: 1 };

/** A Latte sold hot and cold: milk per temperature plus its flavour lines. */
const latte = (hotMilk: number, coldMilk: number, flavour: RecipeCatalogLine[], shots = 1): RecipeCatalogLine[] => [
  ...shot(shots),
  ...flavour,
  { ingredient: 'Leche deslactosada', quantity: hotMilk, temperature: 'HOT' },
  { ingredient: 'Leche deslactosada', quantity: coldMilk, temperature: 'COLD' },
  ...hotCup,
  ...coldCup(),
  sticker,
  tray,
];

const chai = (powder: string): RecipeCatalogLine[] => [
  { ingredient: 'Agua', quantity: 50 },
  { ingredient: powder, quantity: 35 },
  { ingredient: 'Leche deslactosada', quantity: 300, temperature: 'HOT' },
  { ingredient: 'Leche deslactosada', quantity: 150, temperature: 'COLD' },
  ...hotCup,
  ...coldCup(),
  sticker,
  tray,
];

const chilaquiles = (sauce: 'Salsa roja' | 'Salsa verde', protein: RecipeCatalogLine[] = []): RecipeCatalogLine[] => [
  { ingredient: 'Totopos', quantity: 140 },
  { ingredient: sauce, quantity: 130 },
  ...protein,
  { ingredient: 'Crema lala', quantity: 30 },
  { ingredient: 'Queso Fresco', quantity: 20 },
  { ingredient: 'Mezcla de quesos', quantity: 20 },
  { ingredient: 'Cebolla', quantity: 10 },
  { ingredient: 'Tenedores', quantity: 1 },
  { ingredient: 'Contenedor carton', quantity: 1 },
  { ingredient: 'Tapa contenedor carton', quantity: 1 },
];

const blackBox: RecipeCatalogLine[] = [
  { ingredient: 'Contenedor negro', quantity: 1 },
  { ingredient: 'Tapa contenedor negro', quantity: 1 },
  { ingredient: 'Cubiertos (tenedor, cuchillo)', quantity: 1 },
];

const bagelWrap: RecipeCatalogLine[] = [
  { ingredient: 'Papel decorativo', quantity: 1 },
  { ingredient: 'Sticker REDONDO', quantity: 1 },
];

export const RECIPE_CATALOG: RecipeCatalogEntry[] = [
  // --- Bebidas ---
  {
    sku: 'BEV-001', sheetName: 'BA-01 Espresso',
    regular: [...shot(1), { ingredient: 'Vaso espresso con tapa', quantity: 1 }, { ingredient: 'Fajo de carton', quantity: 1 }, tray],
  },
  { sku: 'BEV-002', sheetName: 'BA-09/BA-18 Latte regular', jumbo: true, regular: latte(300, 270, []) },
  {
    sku: 'BEV-003', sheetName: 'BA-10/BA-19 Latte Vainilla', jumbo: true,
    regular: latte(300, 250, [{ ingredient: 'French Vainilla', quantity: 59 }]),
  },
  {
    sku: 'BEV-004', sheetName: 'BA-12/BA-21 Latte Caramel Macciato', jumbo: true,
    regular: latte(300, 250, [
      { ingredient: 'Caramel Machiato', quantity: 29 },
      { ingredient: 'Caramelo', quantity: 15, temperature: 'HOT' },
      { ingredient: 'Caramelo', quantity: 16, temperature: 'COLD' },
    ]),
  },
  {
    sku: 'BEV-005', sheetName: 'BA-13/BA-24 Latte Moka', jumbo: true,
    regular: latte(300, 250, [
      { ingredient: 'Hersheys', quantity: 20, temperature: 'HOT' },
      { ingredient: 'Hersheys', quantity: 14, temperature: 'COLD' },
    ]),
  },
  {
    sku: 'BEV-006', sheetName: 'BA-14/BA-22 Latte Biscoff', jumbo: true,
    regular: latte(300, 120, [
      { ingredient: 'Crema de biscoff', quantity: 28 },
      { ingredient: 'Cajeta', quantity: 10, temperature: 'HOT' },
      { ingredient: 'Cajeta', quantity: 17, temperature: 'COLD' },
    ]),
  },
  {
    sku: 'BEV-007', sheetName: "BA-16/BA-25 Latte Andy's", jumbo: true,
    regular: latte(300, 200, [{ ingredient: 'Leche condensada', quantity: 30 }], 2),
  },
  {
    sku: 'BEV-008', sheetName: 'BA-17/BA-26 Americano',
    regular: [
      { ingredient: 'Café molido', quantity: 12 },
      // Espresso water (60 ml) plus the added water: 300 ml hot, 50 ml cold.
      { ingredient: 'Agua', quantity: 360, temperature: 'HOT' },
      { ingredient: 'Agua', quantity: 110, temperature: 'COLD' },
      ...hotCup,
      ...coldCup(),
      sticker,
      tray,
    ],
  },
  {
    sku: 'BEV-018', sheetName: 'BA-27 Coffee Cream',
    regular: [
      { ingredient: 'Café molido', quantity: 24 },
      { ingredient: 'Agua', quantity: 170 },
      { ingredient: 'Nieve', quantity: 60 },
      { ingredient: 'Hielo', quantity: 160 },
      { ingredient: 'Vaso café frio', quantity: 1 },
      { ingredient: 'Tapa vaso frio', quantity: 1 },
      sticker,
      { ingredient: 'Fajo de carton', quantity: 1 },
      tray,
    ],
  },
  { sku: 'BEV-019', sheetName: 'BA-29 Chai vainilla (frío y caliente)', setTemperature: 'BOTH', regular: chai('Chai Vainilla') },
  { sku: 'BEV-020', sheetName: 'BA-30 Chai guayaba (frío y caliente)', setTemperature: 'BOTH', regular: chai('Chai Guayaba') },
  {
    sku: 'BEV-021', sheetName: 'CA-22 Limonada',
    regular: [
      { ingredient: 'Agua', quantity: 200 },
      { ingredient: 'Azucar', quantity: 15 },
      { ingredient: 'Hielo', quantity: 140 },
      { ingredient: 'Limon eureka', quantity: 10 },
      { ingredient: 'Concentrado de limón', quantity: 60 },
      { ingredient: 'Vaso café frio', quantity: 1 },
      { ingredient: 'Tapa vaso frio', quantity: 1 },
      sticker,
      tray,
    ],
  },

  // --- Bagels (the sheet says "AGREGAR EMPAQUE": packaging still missing) ---
  {
    sku: 'BAG-002', sheetName: 'CA-02 Bagel de pollo',
    regular: [
      { ingredient: 'Bagels', quantity: 1 },
      { ingredient: 'Jitomate', quantity: 29 },
      { ingredient: 'Cebolla', quantity: 30 },
      { ingredient: 'Lechuga', quantity: 40 },
      { ingredient: 'Pollo', quantity: 80 },
      { ingredient: 'Aguacate', quantity: 50 },
      { ingredient: 'Mezcla de quesos', quantity: 30 },
      ...bagelWrap,
    ],
  },
  {
    sku: 'BAG-003', sheetName: 'CA-03 Bagel americano',
    regular: [
      { ingredient: 'Bagel congelado', quantity: 1 },
      { ingredient: 'Lechuga', quantity: 15 },
      { ingredient: 'Huevo', quantity: 1 },
      { ingredient: 'Tocino', quantity: 60 },
      { ingredient: 'Crema lala', quantity: 30 },
      ...bagelWrap,
    ],
  },
  {
    sku: 'BAG-004', sheetName: 'CA-04 Bagel carnivoro',
    regular: [
      { ingredient: 'Bagels', quantity: 1 },
      { ingredient: 'Jitomate', quantity: 29 },
      { ingredient: 'Cebolla', quantity: 30 },
      { ingredient: 'Lechuga', quantity: 40 },
      { ingredient: 'Arrachera', quantity: 80 },
      { ingredient: 'Aguacate', quantity: 50 },
      { ingredient: 'Mezcla de quesos', quantity: 30 },
      { ingredient: 'Crema lala', quantity: 30 },
      ...bagelWrap,
    ],
  },

  // --- Desayunos ---
  { sku: 'DES-001', sheetName: 'Chilaquiles naturales rojos', regular: chilaquiles('Salsa roja') },
  { sku: 'DES-002', sheetName: 'Chilaquiles naturales verdes', regular: chilaquiles('Salsa verde') },
  { sku: 'DES-003', sheetName: 'Chilaquiles pollo rojos', regular: chilaquiles('Salsa roja', [{ ingredient: 'Pollo', quantity: 60 }]) },
  { sku: 'DES-004', sheetName: 'Chilaquiles pollo verdes', regular: chilaquiles('Salsa verde', [{ ingredient: 'Pollo', quantity: 60 }]) },
  // The sheet repeats "Chilaquiles huevo" with salsa verde twice: the second one is taken as rojos.
  { sku: 'DES-005', sheetName: 'Chilaquiles huevo rojos', regular: chilaquiles('Salsa roja', [{ ingredient: 'Huevo', quantity: 2 }]) },
  { sku: 'DES-006', sheetName: 'Chilaquiles huevo verdes', regular: chilaquiles('Salsa verde', [{ ingredient: 'Huevo', quantity: 2 }]) },
  { sku: 'DES-007', sheetName: 'Chilaquiles arrachera rojos', regular: chilaquiles('Salsa roja', [{ ingredient: 'Arrachera', quantity: 80 }]) },
  { sku: 'DES-008', sheetName: 'Chilaquiles arrachera verdes', regular: chilaquiles('Salsa verde', [{ ingredient: 'Arrachera', quantity: 80 }]) },
  {
    sku: 'DES-009', sheetName: 'CA-14 Canadiense',
    regular: [
      { ingredient: 'Huevo', quantity: 3 },
      { ingredient: 'Mantequilla', quantity: 5 },
      { ingredient: 'Sal', quantity: 0.5 },
      { ingredient: 'Papa Hashbrown', quantity: 1 },
      { ingredient: 'Tocino', quantity: 60 },
      { ingredient: 'Waffles', quantity: 2 },
      { ingredient: 'Miel mapple', quantity: 15 },
      ...blackBox,
    ],
  },
  {
    sku: 'DES-010', sheetName: 'CA-15 Viajero',
    regular: [
      { ingredient: 'Huevo', quantity: 3 },
      { ingredient: 'Tocino', quantity: 60 },
      { ingredient: 'Sal', quantity: 0.5 },
      { ingredient: 'Papa Hashbrown', quantity: 1 },
      { ingredient: 'Aderezo chipotle', quantity: 15 },
      ...blackBox,
    ],
  },
  {
    sku: 'DES-011', sheetName: 'CA-16 Duo continental',
    regular: [
      { ingredient: 'Huevo', quantity: 3 },
      { ingredient: 'Pan frances', quantity: 1 },
      { ingredient: 'Leche condensada', quantity: 15 },
      { ingredient: 'Ensalada', quantity: 1 },
      ...blackBox,
    ],
  },

  // --- Otros ---
  {
    sku: 'OTR-003', sheetName: 'CA-21 Mini bagel philadelphia',
    regular: [
      { ingredient: 'Queso philadelphia', quantity: 14 },
      { ingredient: 'Mini bagel', quantity: 1 },
      ...bagelWrap,
    ],
  },
];

const normalize = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const normalizeIngredientName = normalize;

/** Jumbo recipe from the regular one: food ×1.5, packaging ×1, cups replaced by the Jumbo cup. */
export function jumboOf(regular: RecipeCatalogLine[]): RecipeCatalogLine[] {
  return regular.map((line) => {
    const key = normalize(line.ingredient);
    if (JUMBO_CUP[key]) return { ...line, ingredient: JUMBO_CUP[key] };
    if (PACKAGING.has(key)) return line;
    return { ...line, quantity: Math.round(line.quantity * JUMBO_FACTOR * 10000) / 10000 };
  });
}
