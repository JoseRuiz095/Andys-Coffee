/**
 * Catalog normalization (docs/Project/plan-inventario-tiempo-real.md, phase 2). Idempotent.
 *
 *   cd backend && npx tsx scripts/normalize-catalog.ts                      # dry run (default)
 *   cd backend && npx tsx scripts/normalize-catalog.ts --apply              # writes
 *   ... --with-ingredients   also creates the ingredients of prisma/ingredient-catalog.ts
 *
 * Targets the database of .env.<NODE_ENV> (development by default). The dry run executes
 * every change inside one transaction and rolls it back, so it reports exactly what --apply
 * would do. A second --apply reports no changes.
 *
 * 1. Units: one unit per measure (gr, kg, ml, lt, pz) with dimension and factor; duplicates
 *    ("g", "Gramos", "pieza", "bote"…) are merged into it.
 * 2. Ingredients: stocked in base units (kg → gr, lt → ml, converting stock, cost, recipes and
 *    history), a INS-### SKU for every ingredient, capitalized all-lowercase names.
 * 3. Categories: "Bebidas" flagged as beverage.
 * 4. Products: beverages get their temperature, products get the POS family/variant the menu
 *    used to guess from the name (Chilaquiles also salsa/proteína options), and the separate
 *    "Latte Jumbo" product is deactivated (the Jumbo size is the lattes' jumboPrice).
 * 5. Report only: SKUs outside the pattern, zero costs, repeated display order, combos named
 *    as promotions, duplicate names, recipe quantities and movement types the step-2
 *    migration validates.
 */
import { Prisma, type UnitDimension } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { INGREDIENT_CATALOG, type BaseUnit } from '../prisma/ingredient-catalog';

const APPLY = process.argv.includes('--apply');
const WITH_INGREDIENTS = process.argv.includes('--with-ingredients');

type Tx = Prisma.TransactionClient;
class DryRunRollback extends Error {}

const changes: string[] = [];
const warnings: string[] = [];
const change = (message: string) => changes.push(message);
const warn = (message: string) => warnings.push(message);

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------------------------
// 1. Units
// ---------------------------------------------------------------------------------------------
type UnitKey = 'gr' | 'kg' | 'ml' | 'lt' | 'pz';
const CANONICAL_UNITS: Record<UnitKey, { name: string; dimension: UnitDimension; factor: number }> = {
  gr: { name: 'Gramo', dimension: 'MASS', factor: 1 },
  kg: { name: 'Kilogramo', dimension: 'MASS', factor: 1000 },
  ml: { name: 'Mililitro', dimension: 'VOLUME', factor: 1 },
  lt: { name: 'Litro', dimension: 'VOLUME', factor: 1000 },
  pz: { name: 'Pieza', dimension: 'COUNT', factor: 1 },
};
const UNIT_ALIASES: Record<string, UnitKey> = {
  g: 'gr', gr: 'gr', grs: 'gr', gramo: 'gr', gramos: 'gr',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml',
  l: 'lt', lt: 'lt', lts: 'lt', litro: 'lt', litros: 'lt',
  pz: 'pz', pza: 'pz', pzas: 'pz', pie: 'pz', pieza: 'pz', piezas: 'pz',
  // Containers are counted as pieces (one jar = one piece).
  bote: 'pz', bot: 'pz', botes: 'pz', paquete: 'pz', paq: 'pz', paquetes: 'pz',
};
const CONTAINER_ALIASES = new Set(['bote', 'bot', 'botes', 'paquete', 'paq', 'paquetes']);

async function normalizeUnits(tx: Tx) {
  const units = await tx.inventoryUnit.findMany({ orderBy: { createdAt: 'asc' } });
  const groups = new Map<UnitKey, typeof units>();
  for (const unit of units) {
    const key = UNIT_ALIASES[normalize(unit.abbreviation)] ?? UNIT_ALIASES[normalize(unit.name)];
    if (!key) {
      warn(`Unidad desconocida "${unit.name}" (${unit.abbreviation}): revísala a mano.`);
      continue;
    }
    if (CONTAINER_ALIASES.has(normalize(unit.abbreviation)) || CONTAINER_ALIASES.has(normalize(unit.name))) {
      warn(`La unidad "${unit.name}" se cuenta como pieza: revisa las cantidades de sus insumos.`);
    }
    groups.set(key, [...(groups.get(key) ?? []), unit]);
  }

  const baseUnitIds = new Map<UnitKey, string>();
  for (const key of Object.keys(CANONICAL_UNITS) as UnitKey[]) {
    const spec = CANONICAL_UNITS[key];
    const members = groups.get(key) ?? [];
    // Keep the unit that already has the canonical abbreviation, else the oldest one.
    const canonical = members.find((unit) => unit.abbreviation === key) ?? members[0];
    let canonicalId: string;
    if (!canonical) {
      canonicalId = (await tx.inventoryUnit.create({ data: { name: spec.name, abbreviation: key, dimension: spec.dimension, factor: spec.factor } })).id;
      change(`Unidad creada: ${spec.name} (${key}).`);
    } else {
      canonicalId = canonical.id;
      if (canonical.name !== spec.name || canonical.abbreviation !== key || canonical.dimension !== spec.dimension || !canonical.factor.eq(spec.factor)) {
        await tx.inventoryUnit.update({ where: { id: canonical.id }, data: { name: spec.name, abbreviation: key, dimension: spec.dimension, factor: spec.factor } });
        change(`Unidad "${canonical.name}" (${canonical.abbreviation}) → ${spec.name} (${key}), ${spec.dimension} ×${spec.factor}.`);
      }
    }
    for (const duplicate of members.filter((unit) => unit.id !== canonicalId)) {
      const moved = await tx.ingredient.updateMany({ where: { unitId: duplicate.id }, data: { unitId: canonicalId } });
      await tx.inventoryUnit.delete({ where: { id: duplicate.id } });
      change(`Unidad duplicada "${duplicate.name}" (${duplicate.abbreviation}) fusionada en ${key}: ${moved.count} insumo(s) reasignado(s).`);
    }
    baseUnitIds.set(key, canonicalId);
  }
  return baseUnitIds;
}

// ---------------------------------------------------------------------------------------------
// 2. Ingredients
// ---------------------------------------------------------------------------------------------
const INGREDIENT_SKU = /^INS-(\d+)$/;

async function normalizeIngredients(tx: Tx, baseUnitIds: Map<UnitKey, string>) {
  const ingredients = await tx.ingredient.findMany({ include: { unit: true }, orderBy: { createdAt: 'asc' } });

  // Non-base units (kg, lt): convert the ingredient and its whole history to gr/ml.
  for (const ingredient of ingredients) {
    const factor = ingredient.unit.factor;
    if (factor.eq(1)) continue;
    const baseKey: UnitKey = ingredient.unit.dimension === 'VOLUME' ? 'ml' : 'gr';
    const f = factor.toString();
    const id = ingredient.id;
    await tx.$executeRaw`UPDATE "ingredients" SET "unitId" = ${baseUnitIds.get(baseKey)},
      "currentStock" = "currentStock" * ${f}::numeric, "minimumStock" = "minimumStock" * ${f}::numeric,
      "maximumStock" = "maximumStock" * ${f}::numeric, "averageCost" = "averageCost" / ${f}::numeric WHERE "id" = ${id}`;
    await tx.$executeRaw`UPDATE "recipes" SET "quantity" = "quantity" * ${f}::numeric WHERE "ingredientId" = ${id}`;
    await tx.$executeRaw`UPDATE "extra_recipes" SET "quantity" = "quantity" * ${f}::numeric WHERE "ingredientId" = ${id}`;
    await tx.$executeRaw`UPDATE "inventory_movements" SET "quantity" = "quantity" * ${f}::numeric,
      "balanceAfter" = "balanceAfter" * ${f}::numeric, "unitCost" = "unitCost" / ${f}::numeric WHERE "ingredientId" = ${id}`;
    await tx.$executeRaw`UPDATE "purchase_items" SET "quantity" = "quantity" * ${f}::numeric,
      "unitCost" = "unitCost" / ${f}::numeric WHERE "ingredientId" = ${id}`;
    await tx.$executeRaw`UPDATE "inventory_count_items" SET "systemQuantity" = "systemQuantity" * ${f}::numeric,
      "countedQuantity" = "countedQuantity" * ${f}::numeric, "difference" = "difference" * ${f}::numeric WHERE "ingredientId" = ${id}`;
    change(`Insumo "${ingredient.name}": ${ingredient.unit.abbreviation} → ${baseKey} (stock, costo, recetas e historial ×${f}).`);
  }

  let lastSku = ingredients.reduce((max, { sku }) => {
    const match = sku ? INGREDIENT_SKU.exec(sku) : null;
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const nextSku = () => `INS-${String(++lastSku).padStart(3, '0')}`;

  const seenNames = new Map<string, string>();
  for (const ingredient of ingredients) {
    const data: Prisma.IngredientUpdateInput = {};
    if (!ingredient.sku?.trim()) data.sku = nextSku();
    const trimmed = ingredient.name.trim();
    if (trimmed === trimmed.toLowerCase() && /[a-z]/.test(trimmed)) {
      data.name = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    } else if (trimmed !== ingredient.name) {
      data.name = trimmed;
    }
    if (Object.keys(data).length > 0) {
      await tx.ingredient.update({ where: { id: ingredient.id }, data });
      change(`Insumo "${ingredient.name}": ${[data.sku && `SKU ${String(data.sku)}`, data.name && `nombre "${String(data.name)}"`].filter(Boolean).join(', ')}.`);
    }
    if (ingredient.deletedAt) continue;
    const key = normalize(ingredient.name);
    const previous = seenNames.get(key);
    if (previous) warn(`Insumos con el mismo nombre: "${previous}" y "${ingredient.name}".`);
    seenNames.set(key, ingredient.name);
  }
  return nextSku;
}

async function loadIngredientCatalog(tx: Tx, baseUnitIds: Map<UnitKey, string>, nextSku: () => string) {
  const existing = await tx.ingredient.findMany({ where: { deletedAt: null }, include: { unit: true } });
  const byName = new Map(existing.map((ingredient) => [
    normalize(ingredient.name),
    { name: ingredient.name, unitId: ingredient.unitId, unit: ingredient.unit.abbreviation },
  ]));
  for (const entry of INGREDIENT_CATALOG) {
    const current = byName.get(normalize(entry.name));
    const unitId = baseUnitIds.get(entry.unit satisfies BaseUnit)!;
    if (current) {
      if (current.unitId !== unitId) {
        warn(`"${current.name}" ya existe en ${current.unit}; el catálogo dice ${entry.unit}. No se cambia.`);
      }
      continue;
    }
    const created = await tx.ingredient.create({ data: { name: entry.name, sku: nextSku(), unitId } });
    byName.set(normalize(entry.name), { name: entry.name, unitId, unit: entry.unit });
    change(`Insumo creado: ${entry.name} (${entry.unit}, ${created.sku}).`);
  }
}

// ---------------------------------------------------------------------------------------------
// 3-4. Categories and products (rules copied from the POS, frontend MenuSection.tsx)
// ---------------------------------------------------------------------------------------------
const BEVERAGE_FAMILIES = ['latte', 'americano', 'espresso', 'cappuccino', 'matcha', 'mocha', 'chai', 'taro', 'chilaquiles'];
const REFRESHER_NAMES = new Set(['bloom', 'limonada']);

function familyOf(name: string): string | null {
  const normalized = normalize(name);
  if (!normalized) return null;
  if (REFRESHER_NAMES.has(normalized)) return 'Refreshers';
  const family = BEVERAGE_FAMILIES.find((prefix) => normalized.startsWith(prefix));
  return family ? family[0].toUpperCase() + family.slice(1) : null;
}

function variantLabelOf(name: string): string {
  const label = name.trim()
    .replace(/^(Latte|Americano|Espresso|Cappuccino|Matcha|Mocha|Chai|Taro|Chilaquiles)[\s-]+/i, '')
    .replace(/\s+(Frio|Frío|Iced|Cold|Caliente|Hot)$/i, '')
    .replace(/\s+(Regular|Classic|Clásico|Normal)$/i, '')
    .trim();
  if (!label) return name.trim();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function chilaquilesOptions(name: string) {
  const normalized = ` ${normalize(name)} `;
  const salsa = normalized.includes(' verdes ') ? 'Verde' : 'Roja';
  const protein = normalized.includes(' pollo ') ? 'Pollo'
    : normalized.includes(' arrachera ') ? 'Arrachera'
    : normalized.includes(' huevo ') ? 'Huevo'
    : 'Naturales';
  return [{ name: 'Salsa', value: salsa }, { name: 'Proteína', value: protein }];
}

function temperatureFromName(name: string): 'HOT' | 'COLD' | null {
  const normalized = normalize(name);
  if (/(?:^|\s)(?:frio|iced|cold)$/.test(normalized)) return 'COLD';
  if (/(?:^|\s)(?:caliente|hot)$/.test(normalized)) return 'HOT';
  if (/^(?:latte|americano|espresso|cappuccino|matcha|mocha|chai|taro)\b/.test(normalized)) return 'HOT';
  return null;
}

async function normalizeCategoriesAndProducts(tx: Tx) {
  const beverages = await tx.category.updateMany({
    where: { isBeverage: false, name: { equals: 'Bebidas', mode: 'insensitive' } },
    data: { isBeverage: true },
  });
  if (beverages.count > 0) change('Categoría "Bebidas" marcada como bebida.');

  const products = await tx.product.findMany({
    include: { category: true, options: true },
    orderBy: [{ categoryId: 'asc' }, { displayOrder: 'asc' }],
  });

  for (const product of products) {
    if (product.isActive && normalize(product.name) === 'latte jumbo') {
      await tx.product.update({ where: { id: product.id }, data: { isActive: false } });
      product.isActive = false;
      change(`Producto "${product.name}" (${product.sku}) desactivado: el tamaño Jumbo es el precio Jumbo de cada latte.`);
    }
    if (product.category?.isBeverage || normalize(product.category?.name ?? '') === 'bebidas') {
      if (!product.temperature) {
        const temperature = temperatureFromName(product.name);
        if (temperature) {
          await tx.product.update({ where: { id: product.id }, data: { temperature } });
          change(`Producto "${product.name}": temperatura ${temperature} (antes se deducía del nombre).`);
        } else {
          warn(`Bebida "${product.name}" sin temperatura: captúrala en el producto.`);
        }
      }
    }
  }

  // Families, from the same rule the POS applied to the names.
  const families = await tx.productFamily.findMany();
  const familyByName = new Map(families.map((family) => [normalize(family.name), family]));
  for (const product of products.filter((p) => p.isActive)) {
    const familyName = familyOf(product.name);
    if (!familyName) continue;
    let family = familyByName.get(normalize(familyName));
    if (!family) {
      family = await tx.productFamily.create({
        data: { name: familyName, categoryId: product.categoryId, displayOrder: product.displayOrder },
      });
      familyByName.set(normalize(familyName), family);
      change(`Familia creada: ${familyName}.`);
    }
    const data: Prisma.ProductUpdateInput = {};
    if (!product.familyId) data.family = { connect: { id: family.id } };
    if (!product.variantLabel) data.variantLabel = variantLabelOf(product.name);
    if (Object.keys(data).length > 0) {
      await tx.product.update({ where: { id: product.id }, data });
      change(`Producto "${product.name}" → familia ${familyName}${data.variantLabel ? `, variante "${String(data.variantLabel)}"` : ''}.`);
    }
    if (familyName === 'Chilaquiles' && product.options.length === 0) {
      const options = chilaquilesOptions(product.name);
      await tx.productVariantOption.createMany({ data: options.map((option) => ({ productId: product.id, ...option })) });
      change(`Producto "${product.name}": opciones ${options.map((o) => `${o.name}=${o.value}`).join(', ')}.`);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// 5. Report only
// ---------------------------------------------------------------------------------------------
const PRODUCT_SKU = /^[A-Z]{3}-\d{3}$/;
const MOVEMENT_TYPES = ['purchase', 'exit', 'adjustment', 'sale', 'sale_reversal'];

async function report(tx: Tx) {
  const products = await tx.product.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  const byName = new Map<string, string[]>();
  const byOrder = new Map<string, string[]>();
  for (const product of products) {
    if (!PRODUCT_SKU.test(product.sku)) warn(`SKU fuera del patrón AAA-000: "${product.name}" (${product.sku}). No se renombra: es la clave de sincronización.`);
    if (product.cost.eq(0)) warn(`Producto "${product.name}" con costo 0.`);
    byName.set(normalize(product.name), [...(byName.get(normalize(product.name)) ?? []), product.name]);
    const orderKey = `${product.categoryId ?? '-'}:${product.displayOrder}`;
    byOrder.set(orderKey, [...(byOrder.get(orderKey) ?? []), product.name]);
  }
  for (const names of byName.values()) if (names.length > 1) warn(`Productos activos con el mismo nombre: ${names.join(', ')} (bloquea el índice único del paso 2).`);
  for (const names of byOrder.values()) if (names.length > 1) warn(`Mismo orden de despliegue en la categoría: ${names.join(', ')}.`);

  const combos = await tx.combo.findMany({ where: { isActive: true }, select: { name: true } });
  for (const combo of combos) if (/^promo/i.test(combo.name)) warn(`El combo "${combo.name}" funciona como promoción.`);

  const badRecipes = await tx.recipe.count({ where: { quantity: { lte: 0 } } });
  const badExtraRecipes = await tx.extraRecipe.count({ where: { quantity: 0 } });
  const badMovements = await tx.inventoryMovement.groupBy({ by: ['type'], where: { type: { notIn: MOVEMENT_TYPES } }, _count: true });
  if (badRecipes > 0) warn(`${badRecipes} línea(s) de receta con cantidad ≤ 0 (bloquean el paso 2).`);
  if (badExtraRecipes > 0) warn(`${badExtraRecipes} línea(s) de receta de extra con cantidad 0 (bloquean el paso 2).`);
  for (const row of badMovements) warn(`${row._count} movimiento(s) con tipo desconocido "${row.type}" (bloquean el paso 2).`);
}

async function main() {
  const host = (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '').replace(/\/\/[^@]*@/, '//***@').replace(/\?.*/, '');
  process.stdout.write(`${APPLY ? 'APLICANDO' : 'SIMULACIÓN (sin cambios)'} sobre ${host}\n\n`);

  try {
    await prisma.$transaction(async (tx) => {
      const baseUnitIds = await normalizeUnits(tx);
      const nextSku = await normalizeIngredients(tx, baseUnitIds);
      if (WITH_INGREDIENTS) await loadIngredientCatalog(tx, baseUnitIds, nextSku);
      await normalizeCategoriesAndProducts(tx);
      await report(tx);
      if (!APPLY) throw new DryRunRollback();
    }, { timeout: 120_000, maxWait: 20_000 });
  } catch (error) {
    if (!(error instanceof DryRunRollback)) throw error;
  }

  process.stdout.write(`Cambios (${changes.length}):\n${changes.map((c) => `  - ${c}`).join('\n') || '  (ninguno)'}\n\n`);
  process.stdout.write(`Avisos (${warnings.length}):\n${warnings.map((w) => `  - ${w}`).join('\n') || '  (ninguno)'}\n\n`);
  process.stdout.write(APPLY ? 'Listo: cambios guardados.\n' : 'Simulación: no se guardó nada. Usa --apply para escribir.\n');
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
