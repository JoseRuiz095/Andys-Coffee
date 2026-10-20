/**
 * Menu image catalog: the original photos of the menu, converted to WebP and committed in
 * backend/assets/menu-images/<Folder>/<Name>.webp. `npm run images:migrate` uploads them to
 * the bucket under "catalog/<Folder>/<Name>.webp" (the value stored in imageUrl).
 *
 * The SKU/name assignments below are explicit (decided by the business, not guessed from the
 * product name at runtime). The seed and the migration script both read them.
 */
import path from "node:path";

// Scripts and the seed run from backend/ (npm scripts set that working directory).
const backendDir = process.cwd();
export const MENU_IMAGES_DIR = path.join(backendDir, "assets/menu-images");
export const MENU_IMAGES_ORIGINALS_DIR = path.join(backendDir, "assets/menu-images-originals");

/** "Drinks/Andys" → "catalog/Drinks/Andys.webp" */
export const catalogKey = (image: string) => `catalog/${image}.webp`;

export const PRODUCT_IMAGE_BY_SKU: Record<string, string> = {
  "BEV-001": "Drinks/Espresso",
  "BEV-002": "Drinks/Regular",
  "BEV-003": "Drinks/Vainilla",
  "BEV-004": "Drinks/Caramelo",
  "BEV-005": "Drinks/Moka",
  "BEV-006": "Drinks/Biscoff",
  "BEV-007": "Drinks/Andys",
  "BEV-008": "Drinks/Americano",
  "BEV-018": "Drinks/CoffeCream",
  "BEV-021": "Drinks/Limonada",
  "BEV-022": "Drinks/Bloom",
  "BEV-023": "Drinks/Taro",
  "ESP-02": "Drinks/PanMuerto",
  "BAG-001": "Food/Campirano",
  "BAG-002": "Food/Pollo",
  "BAG-003": "Food/BagelAmericano",
  "BAG-004": "Food/Carnivoro",
  "DES-001": "Food/Chilaquiles",
  "DES-002": "Food/Chilaquiles",
  "DES-003": "Food/Chilaquiles",
  "DES-004": "Food/Chilaquiles",
  "DES-005": "Food/Chilaquiles",
  "DES-006": "Food/Chilaquiles",
  "DES-007": "Food/Chilaquiles",
  "DES-008": "Food/Chilaquiles",
  "DES-009": "Food/Canadiense",
  "DES-010": "Food/Viajero",
  "DES-011": "Food/Continental",
  "OTR-001": "Extras/Croissant",
  "OTR-002": "Extras/CroissantSalado",
  "OTR-003": "Extras/MiniPhila",
  "OTR-004": "Extras/Hashbrown",
};

export const COMBO_IMAGE_BY_NAME: Record<string, string> = {
  "Combo Matutino": "Combos/Matutino",
  "Combo de la casa": "Combos/Casa",
  "Promo Jueves: 2 Viajeros por $170": "Food/Viajero",
};

/**
 * File names used in the old bucket ("Menu/<file>") whose catalog image has another name.
 * Keys are lowercase file names without extension.
 */
export const LEGACY_FILE_ALIASES: Record<string, string> = {
  coffeecream: "Drinks/CoffeCream",
  hash: "Extras/Hashbrown",
  combomatutino: "Combos/Matutino",
  combocasa: "Combos/Casa",
};

/** Old default image the seed assigned to products without a photo: it means "no image". */
export const LEGACY_PLACEHOLDERS = new Set(["menu/logoandysvector.svg"]);

// ---------------------------------------------------------------------------------------------
// Migration plan (pure, unit-tested in test/menu-images.test.ts)
// ---------------------------------------------------------------------------------------------

export type ImageRow = {
  table: "product" | "combo" | "category";
  id: string;
  name: string;
  sku?: string;
  imageUrl: string | null;
};

export type ImageDecision = {
  row: ImageRow;
  action: "keep" | "migrate" | "assign" | "unresolved";
  to?: string;
  reason: string;
};

type KeyResolver = (stored: string) => string | null;

const fileStem = (value: string) => {
  const last = value.split("/").pop() ?? value;
  return last.replace(/\.[^.]+$/, "").toLowerCase();
};

function explicitImage(row: ImageRow): string | undefined {
  if (row.table === "product" && row.sku) return PRODUCT_IMAGE_BY_SKU[row.sku];
  if (row.table === "combo") return COMBO_IMAGE_BY_NAME[row.name];
  return undefined;
}

/**
 * Decides, per row, what its imageUrl becomes. Existing assignments are kept: an old bucket
 * path ("Menu/<file>") or URL moves to the catalog image of the SAME file (same file name or
 * a documented alias). Only rows without an image (or with the old placeholder) get the
 * explicit assignment of PRODUCT_IMAGE_BY_SKU / COMBO_IMAGE_BY_NAME. Anything else is left
 * untouched and reported.
 */
export function planImageMigration(rows: ImageRow[], catalog: string[], toKey: KeyResolver): ImageDecision[] {
  const byStem = new Map<string, string[]>();
  for (const image of catalog) {
    const stem = fileStem(image);
    byStem.set(stem, [...(byStem.get(stem) ?? []), image]);
  }
  const catalogSet = new Set(catalog);

  return rows.map((row): ImageDecision => {
    const explicit = explicitImage(row);
    const assign = (reason: string): ImageDecision =>
      explicit && catalogSet.has(explicit)
        ? { row, action: "assign", to: catalogKey(explicit), reason: `${reason}; asignación explícita (${explicit})` }
        : { row, action: "keep", reason };

    if (!row.imageUrl) return assign("sin imagen");

    let key = toKey(row.imageUrl);
    if (!key && /^https?:\/\//i.test(row.imageUrl)) {
      try {
        key = decodeURIComponent(new URL(row.imageUrl).pathname);
      } catch {
        key = null;
      }
    }
    if (!key) return { row, action: "unresolved", reason: "referencia no válida" };
    if (key.startsWith("catalog/")) return { row, action: "keep", reason: "ya está en el catálogo" };
    if (key.startsWith("products/") || key.startsWith("public/")) {
      return { row, action: "keep", reason: "imagen subida desde la app" };
    }
    if (LEGACY_PLACEHOLDERS.has(key.replace(/^\/+/, "").toLowerCase())) return assign("logo por defecto");

    const stem = fileStem(key);
    const alias = LEGACY_FILE_ALIASES[stem];
    const matches = alias ? [alias] : byStem.get(stem) ?? [];
    if (matches.length === 1 && catalogSet.has(matches[0])) {
      const note = explicit && explicit !== matches[0] ? `; menu-images.ts indica ${explicit}, se conserva la actual` : "";
      return { row, action: "migrate", to: catalogKey(matches[0]), reason: `misma foto: ${key} → ${matches[0]}${note}` };
    }
    return {
      row,
      action: "unresolved",
      reason: matches.length > 1 ? `nombre ambiguo (${matches.join(", ")})` : `sin foto equivalente en el catálogo (${key})`,
    };
  });
}
