import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { toStorageKey } from "../src/utils/imageKeys";
import {
  COMBO_IMAGE_BY_NAME,
  MENU_IMAGES_DIR,
  PRODUCT_IMAGE_BY_SKU,
  planImageMigration,
  type ImageRow,
} from "../prisma/menu-images";

const config = { supabaseUrl: "https://abc.supabase.co", bucket: "Img" };
const toKey = (stored: string) => toStorageKey(stored, config);
const CATALOG = ["Drinks/Andys", "Drinks/Regular", "Drinks/Vainilla", "Drinks/CoffeCream", "Food/Pollo", "Combos/Casa"];

const product = (sku: string, imageUrl: string | null): ImageRow => ({ table: "product", id: sku, sku, name: sku, imageUrl });
const plan = (row: ImageRow) => planImageMigration([row], CATALOG, toKey)[0];

test("conserva la asignación existente aunque el mapa sugiera otra foto", () => {
  const decision = plan(product("BEV-002", "Menu/Andys.png"));
  assert.equal(decision.action, "migrate");
  assert.equal(decision.to, "catalog/Drinks/Andys.webp");
  assert.match(decision.reason, /se conserva la actual/);
});

test("migra URLs completas del bucket a la misma foto del catálogo", () => {
  const decision = plan(product("BAG-002", "https://abc.supabase.co/storage/v1/object/public/Img/Menu/Pollo.png"));
  assert.equal(decision.to, "catalog/Food/Pollo.webp");
});

test("usa alias documentados para nombres antiguos distintos", () => {
  assert.equal(plan(product("BEV-018", "Menu/CoffeeCream.png")).to, "catalog/Drinks/CoffeCream.webp");
  assert.equal(plan({ table: "combo", id: "c", name: "Combo de la casa", imageUrl: "Menu/ComboCasa.png" }).to, "catalog/Combos/Casa.webp");
});

test("solo asigna por mapa explícito a productos sin imagen o con el logo por defecto", () => {
  assert.equal(plan(product("BEV-003", null)).to, "catalog/Drinks/Vainilla.webp");
  assert.equal(plan(product("BEV-003", "Menu/LogoAndysVector.svg")).to, "catalog/Drinks/Vainilla.webp");
  assert.equal(plan(product("SIN-MAPA", null)).action, "keep");
});

test("no toca imágenes subidas desde la app ni las ya migradas", () => {
  assert.equal(plan(product("BEV-002", "https://abc.supabase.co/storage/v1/object/public/Img/public/uuid.png")).action, "keep");
  assert.equal(plan(product("BEV-002", "products/x/y.webp")).action, "keep");
  assert.equal(plan(product("BEV-002", "catalog/Drinks/Regular.webp")).action, "keep");
});

test("reporta referencias sin foto equivalente sin modificarlas", () => {
  const decision = plan(product("BEV-001", "Menu/espresso_viejo.png"));
  assert.equal(decision.action, "unresolved");
  assert.equal(decision.to, undefined);
});

test("cada asignación del mapa apunta a un archivo WebP existente", () => {
  for (const image of [...Object.values(PRODUCT_IMAGE_BY_SKU), ...Object.values(COMBO_IMAGE_BY_NAME)]) {
    assert.ok(fs.existsSync(`${MENU_IMAGES_DIR}/${image}.webp`), `${image}.webp no existe`);
  }
});
