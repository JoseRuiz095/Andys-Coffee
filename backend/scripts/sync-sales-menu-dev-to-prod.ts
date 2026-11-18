import { Prisma, type PrismaClient } from '@prisma/client';
import { appliedMigrations, assertRunFromBackend, createDatabase } from './lib/dev-prod-databases';
import { assertProductionWriteConfirmed } from '../prisma/seed-guards';

// Connections (and the local-only exception to SSL used to rehearse on a Docker copy of
// production) live in scripts/lib/dev-prod-databases.ts, shared with sync-inventory-dev-to-prod.
assertRunFromBackend();

/**
 * `--deactivate-missing-products`: active production products whose SKU development no longer
 * has (e.g. the separate "… Frio" drinks, now one product sold hot or cold) are deactivated —
 * never deleted, so their sales, reports and cash cuts stay intact. Off by default.
 */
const DEACTIVATE_MISSING = process.argv.includes('--deactivate-missing-products');

async function readMenu(db: PrismaClient) {
  const [categories, products, extras, productExtras, combos, promotions, families, ingredients, recipes, extraRecipes] = await Promise.all([
    db.category.findMany({ orderBy: { displayOrder: 'asc' } }),
    db.product.findMany({
      include: {
        category: { select: { name: true } },
        family: { select: { name: true } },
        options: { select: { name: true, value: true }, orderBy: { name: 'asc' } },
      },
      orderBy: [{ categoryId: 'asc' }, { displayOrder: 'asc' }],
    }),
    db.extra.findMany({ orderBy: { name: 'asc' } }),
    db.productExtra.findMany({ include: { product: { select: { sku: true } }, extra: { select: { name: true } } } }),
    db.combo.findMany({
      include: {
        category: { select: { name: true } },
        items: { include: { product: { select: { sku: true } } } },
      },
      orderBy: { displayOrder: 'asc' },
    }),
    db.promotion.findMany({
      include: {
        products: { include: { product: { select: { sku: true } } } },
        categories: { include: { category: { select: { name: true } } } },
      },
      orderBy: { name: 'asc' },
    }),
    db.productFamily.findMany({ include: { category: { select: { name: true } } }, orderBy: { name: 'asc' } }),
    // Ingredients travel by SKU; stock and average cost never do (each database has its own).
    db.ingredient.findMany({ where: { deletedAt: null }, include: { unit: { select: { abbreviation: true } } }, orderBy: { name: 'asc' } }),
    db.recipe.findMany({ include: { product: { select: { sku: true } }, ingredient: { select: { sku: true } } } }),
    db.extraRecipe.findMany({ include: { extra: { select: { name: true } }, ingredient: { select: { sku: true } } } }),
  ]);
  return { categories, products, extras, productExtras, combos, promotions, families, ingredients, recipes, extraRecipes };
}

// Temperature (2026-11-16): HOT/COLD lines of products sold both ways; BOTH for the rest.
const recipeLine = ({ size, temperature, ingredient, quantity }: { size: string; temperature: string; ingredient: { sku: string | null }; quantity: Prisma.Decimal }) =>
  `${size}:${temperature}:${ingredient.sku}:${quantity.toString()}`;
const extraRecipeLine = ({ ingredient, quantity }: { ingredient: { sku: string | null }; quantity: Prisma.Decimal }) =>
  `${ingredient.sku}:${quantity.toString()}`;

/** One sorted signature per owner (product SKU or extra name) of its recipe lines. */
function signatures<T>(items: T[], owner: (item: T) => string, line: (item: T) => string) {
  const byOwner = new Map<string, string[]>();
  for (const item of items) byOwner.set(owner(item), [...(byOwner.get(owner(item)) ?? []), line(item)]);
  return new Map([...byOwner].map(([key, lines]) => [key, lines.sort().join('|')]));
}

function signatureMismatches(keys: string[], source: Map<string, string>, destination: Map<string, string>) {
  return keys.filter((key) => (source.get(key) ?? '') !== (destination.get(key) ?? ''));
}

function countByKey<T>(source: T[], destination: T[], key: (item: T) => string) {
  const destinationKeys = new Set(destination.map(key));
  const sourceKeys = new Set(source.map(key));
  return {
    development: source.length,
    production: destination.length,
    newInProduction: source.filter((item) => !destinationKeys.has(key(item))).length,
    presentInBoth: source.filter((item) => destinationKeys.has(key(item))).length,
    onlyInProduction: destination.filter((item) => !sourceKeys.has(key(item))).length,
  };
}

function menuMismatches(source: Awaited<ReturnType<typeof readMenu>>, destination: Awaited<ReturnType<typeof readMenu>>) {
  const compare = <T>(items: T[], destinationItems: T[], key: (item: T) => string, project: (item: T) => unknown) => {
    const destinationByKey = new Map(destinationItems.map((item) => [key(item), item]));
    return items.flatMap((item) => {
      const match = destinationByKey.get(key(item));
      return !match || JSON.stringify(project(item)) !== JSON.stringify(project(match)) ? [key(item)] : [];
    });
  };

  return {
    categories: compare(source.categories, destination.categories, ({ name }) => name, ({ description, imageUrl, displayOrder, isActive, isBeverage }) => ({ description, imageUrl, displayOrder, isActive, isBeverage })),
    families: compare(source.families, destination.families, ({ name }) => name.trim().toLowerCase(), ({ category, displayOrder, isActive }) => ({ category: category?.name ?? null, displayOrder, isActive })),
    ingredients: compare(source.ingredients, destination.ingredients, ({ sku }) => sku ?? '', ({ name, unit, minimumStock, maximumStock, isActive }) => ({
      name, unit: unit.abbreviation, minimumStock: minimumStock.toString(), maximumStock: maximumStock?.toString() ?? null, isActive,
    })),
    products: compare(source.products, destination.products, ({ sku }) => sku, ({ category, name, description, imageUrl, temperature, price, jumboPrice, cost, isActive, displayOrder, tracksInventory, family, variantLabel, options }) => ({
      tracksInventory,
      family: family?.name ?? null,
      variantLabel,
      options: options.map((option) => `${option.name}=${option.value}`),
      category: category?.name ?? null,
      name,
      description,
      imageUrl,
      temperature,
      price: price.toString(),
      jumboPrice: jumboPrice?.toString() ?? null,
      cost: cost.toString(),
      isActive,
      displayOrder,
    })),
    extras: compare(source.extras, destination.extras, ({ name }) => name, ({ description, price, cost, isActive }) => ({ description, price: price.toString(), cost: cost.toString(), isActive })),
    productExtras: compare(source.productExtras, destination.productExtras, ({ product, extra }) => `${product.sku}\0${extra.name}`, ({ isDefault }) => ({ isDefault })),
    combos: compare(source.combos, destination.combos, ({ name }) => name, ({ category, description, price, cost, imageUrl, isActive, activeOnDays, displayOrder, items }) => ({
      category: category?.name ?? null,
      description,
      price: price.toString(),
      cost: cost.toString(),
      imageUrl,
      isActive,
      activeOnDays,
      displayOrder,
      items: items.map(({ product, quantity }) => [product.sku, quantity.toString()]).sort(([skuA], [skuB]) => skuA.localeCompare(skuB)),
    })),
    promotions: compare(source.promotions, destination.promotions, ({ name }) => name, ({ description, type, discountValue, buyQuantity, getQuantity, startDate, endDate, activeOnDays, isActive, products, categories }) => ({
      description,
      type,
      discountValue: discountValue.toString(),
      buyQuantity,
      getQuantity,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      activeOnDays,
      isActive,
      products: products.map(({ product }) => product.sku).sort(),
      categories: categories.map(({ category }) => category.name).sort(),
    })),
    // Recipes compared as a whole per product (by SKU) and per extra (by name).
    recipes: signatureMismatches(
      source.products.map(({ sku }) => sku),
      signatures(source.recipes, ({ product }) => product.sku, recipeLine),
      signatures(destination.recipes, ({ product }) => product.sku, recipeLine),
    ),
    extraRecipes: signatureMismatches(
      source.extras.map(({ name }) => name),
      signatures(source.extraRecipes, ({ extra }) => extra.name, extraRecipeLine),
      signatures(destination.extraRecipes, ({ extra }) => extra.name, extraRecipeLine),
    ),
  };
}

function assertMenuMatches(source: Awaited<ReturnType<typeof readMenu>>, destination: Awaited<ReturnType<typeof readMenu>>) {
  const mismatches = menuMismatches(source, destination);
  const mismatchCount = Object.values(mismatches).reduce((count, items) => count + items.length, 0);
  console.log('Diferencias en elementos compartidos:', JSON.stringify(Object.fromEntries(Object.entries(mismatches).map(([key, items]) => [key, items.length]))));
  if (mismatchCount) {
    throw new Error(`La verificación encontró diferencias: ${JSON.stringify(mismatches)}`);
  }
}

async function readHistoryCounts(tx: Prisma.TransactionClient) {
  const [counts] = await tx.$queryRaw<{
    orders: string;
    orderItems: string;
    orderItemExtras: string;
    payments: string;
    cashSessions: string;
    cashMovements: string;
    inventoryMovements: string;
    purchases: string;
    purchaseItems: string;
    inventoryCounts: string;
    inventoryCountItems: string;
    expenses: string;
    incomeSnapshots: string;
  }[]>`
    SELECT
      (SELECT count(*)::text FROM "orders") AS "orders",
      (SELECT count(*)::text FROM "order_items") AS "orderItems",
      (SELECT count(*)::text FROM "order_item_extras") AS "orderItemExtras",
      (SELECT count(*)::text FROM "payments") AS "payments",
      (SELECT count(*)::text FROM "cash_sessions") AS "cashSessions",
      (SELECT count(*)::text FROM "cash_movements") AS "cashMovements",
      (SELECT count(*)::text FROM "inventory_movements") AS "inventoryMovements",
      (SELECT count(*)::text FROM "purchases") AS "purchases",
      (SELECT count(*)::text FROM "purchase_items") AS "purchaseItems",
      (SELECT count(*)::text FROM "inventory_counts") AS "inventoryCounts",
      (SELECT count(*)::text FROM "inventory_count_items") AS "inventoryCountItems",
      (SELECT count(*)::text FROM "expenses") AS "expenses",
      (SELECT count(*)::text FROM "income_statement_daily_snapshots") AS "incomeSnapshots"
  `;
  return counts;
}

function assertUniqueNames(values: { name: string }[], label: string) {
  const names = values.map(({ name }) => name);
  if (new Set(names).size !== names.length) throw new Error(`Hay nombres duplicados en ${label}; no se aplicó ningún cambio.`);
}

async function syncMenu(source: Awaited<ReturnType<typeof readMenu>>, production: PrismaClient) {
  await production.$transaction(async (tx) => {
    const historyBefore = await readHistoryCounts(tx);
    const categoryIds = new Map<string, string>();
    for (const category of source.categories) {
      const saved = await tx.category.upsert({
        where: { name: category.name },
        create: {
          name: category.name,
          description: category.description,
          imageUrl: category.imageUrl,
          displayOrder: category.displayOrder,
          isActive: category.isActive,
          isBeverage: category.isBeverage,
        },
        update: {
          description: category.description,
          imageUrl: category.imageUrl,
          displayOrder: category.displayOrder,
          isActive: category.isActive,
          isBeverage: category.isBeverage,
        },
      });
      categoryIds.set(category.name, saved.id);
    }

    // Families by name (unique ignoring case and spaces).
    const familyIds = new Map<string, string>();
    for (const family of source.families) {
      const existing = await tx.productFamily.findFirst({ where: { name: { equals: family.name.trim(), mode: 'insensitive' } } });
      const data = {
        name: family.name,
        categoryId: family.category ? categoryIds.get(family.category.name) ?? null : null,
        displayOrder: family.displayOrder,
        isActive: family.isActive,
      };
      const saved = existing
        ? await tx.productFamily.update({ where: { id: existing.id }, data })
        : await tx.productFamily.create({ data });
      familyIds.set(family.name, saved.id);
    }

    const productIds = new Map<string, string>();
    for (const product of source.products) {
      const categoryId = product.category ? categoryIds.get(product.category.name) : null;
      if (product.category && !categoryId) throw new Error(`No se pudo resolver la categoría de ${product.sku}.`);
      const data = {
        categoryId,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        temperature: product.temperature,
        price: product.price,
        jumboPrice: product.jumboPrice,
        cost: product.cost,
        isActive: product.isActive,
        displayOrder: product.displayOrder,
        tracksInventory: product.tracksInventory,
        familyId: product.family ? familyIds.get(product.family.name) ?? null : null,
        variantLabel: product.variantLabel,
      };
      const saved = await tx.product.upsert({
        where: { sku: product.sku },
        create: { ...data, sku: product.sku },
        update: data,
      });
      productIds.set(product.sku, saved.id);
      await tx.productVariantOption.deleteMany({ where: { productId: saved.id } });
      if (product.options.length) {
        await tx.productVariantOption.createMany({ data: product.options.map((option) => ({ productId: saved.id, ...option })) });
      }
    }
    if (DEACTIVATE_MISSING) {
      const missing = await tx.product.findMany({
        where: { isActive: true, sku: { notIn: source.products.map(({ sku }) => sku) } },
        select: { id: true, sku: true, name: true },
      });
      if (missing.length) {
        await tx.product.updateMany({ where: { id: { in: missing.map(({ id }) => id) } }, data: { isActive: false } });
        console.log(`Productos desactivados (no existen en development): ${missing.map(({ sku, name }) => `${sku} ${name}`).join(', ')}`);
      }
    }

    // Ingredients by SKU (scripts/normalize-catalog.ts assigns one to each). Name, minimum,
    // maximum and status are copied; stock and average cost are never touched, and a unit change
    // is refused (it would change the meaning of the stock).
    const units = new Map((await tx.inventoryUnit.findMany()).map((unit) => [unit.abbreviation, unit.id]));
    const ingredientIds = new Map<string, string>();
    for (const ingredient of source.ingredients) {
      if (!ingredient.sku) throw new Error(`El insumo "${ingredient.name}" no tiene SKU en development: ejecuta scripts/normalize-catalog.ts.`);
      const unitId = units.get(ingredient.unit.abbreviation);
      if (!unitId) throw new Error(`Producción no tiene la unidad "${ingredient.unit.abbreviation}" del insumo ${ingredient.sku}.`);
      const existing = await tx.ingredient.findUnique({ where: { sku: ingredient.sku } });
      const data = { name: ingredient.name, minimumStock: ingredient.minimumStock, maximumStock: ingredient.maximumStock, isActive: ingredient.isActive };
      if (existing && existing.unitId !== unitId) {
        throw new Error(`El insumo ${ingredient.sku} tiene otra unidad en producción; corrígelo a mano antes de sincronizar.`);
      }
      const saved = existing
        ? await tx.ingredient.update({ where: { id: existing.id }, data })
        : await tx.ingredient.create({ data: { ...data, sku: ingredient.sku, unitId } });
      ingredientIds.set(ingredient.sku, saved.id);
    }
    const ingredientIdOf = (sku: string | null, owner: string) => {
      const id = sku ? ingredientIds.get(sku) : undefined;
      if (!id) throw new Error(`La receta de ${owner} usa un insumo sin SKU sincronizable (${sku ?? 'sin SKU'}).`);
      return id;
    };

    // Recipes of every synced product: replaced as a whole.
    for (const product of source.products) {
      const productId = productIds.get(product.sku)!;
      await tx.recipe.deleteMany({ where: { productId } });
      const lines = source.recipes.filter((recipe) => recipe.product.sku === product.sku);
      if (lines.length) {
        await tx.recipe.createMany({
          data: lines.map((line) => ({ productId, size: line.size, temperature: line.temperature, ingredientId: ingredientIdOf(line.ingredient.sku, product.sku), quantity: line.quantity })),
        });
      }
    }

    assertUniqueNames(source.extras, 'extras de development');
    const productionExtras = await tx.extra.findMany({ where: { name: { in: source.extras.map(({ name }) => name) } } });
    const extrasByName = new Map<string, typeof productionExtras>();
    for (const extra of productionExtras) extrasByName.set(extra.name, [...(extrasByName.get(extra.name) ?? []), extra]);
    const extraIds = new Map<string, string>();
    for (const extra of source.extras) {
      const matches = extrasByName.get(extra.name) ?? [];
      if (matches.length > 1) throw new Error(`Producción tiene extras duplicados llamados "${extra.name}".`);
      const data = { description: extra.description, price: extra.price, cost: extra.cost, isActive: extra.isActive };
      const saved = matches[0]
        ? await tx.extra.update({ where: { id: matches[0].id }, data })
        : await tx.extra.create({ data: { name: extra.name, ...data } });
      extraIds.set(extra.name, saved.id);
      await tx.extraRecipe.deleteMany({ where: { extraId: saved.id } });
      const lines = source.extraRecipes.filter((recipe) => recipe.extra.name === extra.name);
      if (lines.length) {
        await tx.extraRecipe.createMany({
          data: lines.map((line) => ({ extraId: saved.id, ingredientId: ingredientIdOf(line.ingredient.sku, extra.name), quantity: line.quantity })),
        });
      }
    }

    const linksBySku = new Map<string, typeof source.productExtras>();
    for (const link of source.productExtras) linksBySku.set(link.product.sku, [...(linksBySku.get(link.product.sku) ?? []), link]);
    for (const product of source.products) {
      const productId = productIds.get(product.sku);
      if (!productId) throw new Error(`No se pudo resolver el producto ${product.sku}.`);
      await tx.productExtra.deleteMany({ where: { productId } });
      const links = linksBySku.get(product.sku) ?? [];
      if (links.length) {
        await tx.productExtra.createMany({
          data: links.map((link) => {
            const extraId = extraIds.get(link.extra.name);
            if (!extraId) throw new Error(`No se pudo resolver el extra "${link.extra.name}".`);
            return { productId, extraId, isDefault: link.isDefault };
          }),
        });
      }
    }

    assertUniqueNames(source.combos, 'combos de development');
    for (const combo of source.combos) {
      const categoryId = combo.category ? categoryIds.get(combo.category.name) : null;
      const data = {
        categoryId,
        description: combo.description,
        price: combo.price,
        cost: combo.cost,
        imageUrl: combo.imageUrl,
        isActive: combo.isActive,
        activeOnDays: combo.activeOnDays,
        displayOrder: combo.displayOrder,
      };
      const saved = await tx.combo.upsert({ where: { name: combo.name }, create: { name: combo.name, ...data }, update: data });
      await tx.comboItem.deleteMany({ where: { comboId: saved.id } });
      if (combo.items.length) {
        await tx.comboItem.createMany({
          data: combo.items.map((item) => {
            const productId = productIds.get(item.product.sku);
            if (!productId) throw new Error(`El combo "${combo.name}" referencia el SKU desconocido ${item.product.sku}.`);
            return { comboId: saved.id, productId, quantity: item.quantity };
          }),
        });
      }
    }

    assertUniqueNames(source.promotions, 'promociones de development');
    const existingPromotions = await tx.promotion.findMany({ where: { name: { in: source.promotions.map(({ name }) => name) } } });
    const promotionsByName = new Map<string, typeof existingPromotions>();
    for (const promotion of existingPromotions) promotionsByName.set(promotion.name, [...(promotionsByName.get(promotion.name) ?? []), promotion]);
    for (const promotion of source.promotions) {
      const matches = promotionsByName.get(promotion.name) ?? [];
      if (matches.length > 1) throw new Error(`Producción tiene promociones duplicadas llamadas "${promotion.name}".`);
      const data = {
        description: promotion.description,
        type: promotion.type,
        discountValue: promotion.discountValue,
        buyQuantity: promotion.buyQuantity,
        getQuantity: promotion.getQuantity,
        startDate: promotion.startDate,
        endDate: promotion.endDate,
        activeOnDays: promotion.activeOnDays,
        isActive: promotion.isActive,
      };
      const saved = matches[0]
        ? await tx.promotion.update({ where: { id: matches[0].id }, data })
        : await tx.promotion.create({ data: { name: promotion.name, ...data } });
      await tx.promotionOnProduct.deleteMany({ where: { promotionId: saved.id } });
      await tx.promotionOnCategory.deleteMany({ where: { promotionId: saved.id } });
      const productLinks = promotion.products.map(({ product }) => {
        const productId = productIds.get(product.sku);
        if (!productId) throw new Error(`La promoción "${promotion.name}" referencia el SKU desconocido ${product.sku}.`);
        return { promotionId: saved.id, productId };
      });
      const categoryLinks = promotion.categories.map(({ category }) => {
        const categoryId = categoryIds.get(category.name);
        if (!categoryId) throw new Error(`La promoción "${promotion.name}" referencia la categoría desconocida ${category.name}.`);
        return { promotionId: saved.id, categoryId };
      });
      if (productLinks.length) await tx.promotionOnProduct.createMany({ data: productLinks });
      if (categoryLinks.length) await tx.promotionOnCategory.createMany({ data: categoryLinks });
    }

    const historyAfter = await readHistoryCounts(tx);
    if (JSON.stringify(historyBefore) !== JSON.stringify(historyAfter)) {
      throw new Error('Cambió el conteo de registros históricos durante la sincronización; se revierte toda la transacción.');
    }
    console.log(`Historial protegido (conteos iguales antes/después): ${JSON.stringify(historyAfter)}`);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15_000, timeout: 120_000 });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const development = createDatabase('development');
  const production = createDatabase('production');
  try {
    if (development.identity === production.identity) throw new Error('Development y producción apuntan a la misma base; sincronización cancelada.');
    console.log(`Origen development: ${development.identity}`);
    console.log(`Destino production:  ${production.identity}`);

    const [devMigrations, prodMigrations] = await Promise.all([
      appliedMigrations(development.prisma),
      appliedMigrations(production.prisma),
    ]);
    const devMigrationNames = devMigrations.map(({ migration_name }) => migration_name);
    const prodMigrationNames = prodMigrations.map(({ migration_name }) => migration_name);
    if (JSON.stringify(devMigrationNames) !== JSON.stringify(prodMigrationNames)) {
      const missingInProduction = devMigrationNames.filter((name) => !prodMigrationNames.includes(name));
      const missingInDevelopment = prodMigrationNames.filter((name) => !devMigrationNames.includes(name));
      throw new Error(
        'Las migraciones aplicadas no coinciden; no se realizó ningún cambio.\n' +
        (missingInProduction.length ? `  Pendientes en producción: ${missingInProduction.join(', ')}\n` : '') +
        (missingInDevelopment.length ? `  Solo en producción: ${missingInDevelopment.join(', ')}\n` : ''),
      );
    }

    const [devMenu, prodMenu] = await Promise.all([
      readMenu(development.prisma),
      readMenu(production.prisma),
    ]);
    assertUniqueNames(devMenu.extras, 'extras de development');
    assertUniqueNames(devMenu.combos, 'combos de development');
    assertUniqueNames(devMenu.promotions, 'promociones de development');

    console.log(`Migraciones coincidentes: ${devMigrations.length}`);
    console.log('Vista previa del menú (los elementos exclusivos de producción se conservan):');
    console.table({
      categorías: countByKey(devMenu.categories, prodMenu.categories, ({ name }) => name),
      productos: countByKey(devMenu.products, prodMenu.products, ({ sku }) => sku),
      extras: countByKey(devMenu.extras, prodMenu.extras, ({ name }) => name),
      combos: countByKey(devMenu.combos, prodMenu.combos, ({ name }) => name),
      promociones: countByKey(devMenu.promotions, prodMenu.promotions, ({ name }) => name),
      familias: countByKey(devMenu.families, prodMenu.families, ({ name }) => name.trim().toLowerCase()),
      insumos: countByKey(devMenu.ingredients, prodMenu.ingredients, ({ sku }) => sku ?? ''),
    });
    console.log(`Líneas de receta en development: ${devMenu.recipes.length} de productos, ${devMenu.extraRecipes.length} de extras`);
    console.log(`Relaciones de extras en development: ${devMenu.productExtras.length}`);
    const devSkus = new Set(devMenu.products.map(({ sku }) => sku));
    const missingInDev = prodMenu.products.filter((product) => product.isActive && !devSkus.has(product.sku));
    if (missingInDev.length) {
      console.log(
        `Productos activos de producción que no existen en development (${missingInDev.length}): ` +
          `${missingInDev.map(({ sku, name }) => `${sku} ${name}`).join(', ')}` +
          (DEACTIVATE_MISSING ? ' → se desactivarán.' : ' → se conservan (usa --deactivate-missing-products para desactivarlos).'),
      );
    }

    if (process.argv.includes('--verify')) {
      assertMenuMatches(devMenu, prodMenu);
      console.log('Verificación correcta: todos los elementos compartidos y sus relaciones coinciden.');
      return;
    }

    if (!apply) {
      console.log('Vista previa solamente. Para aplicar esta sincronización: npm run catalog:sync-menu:dev-to-prod -- --apply');
      return;
    }

    // Writing to a remote production database asks for its host (a local copy does not).
    if (production.hostname !== 'localhost' && production.hostname !== '127.0.0.1') {
      assertProductionWriteConfirmed({ envMode: 'production', usesProductionDatabase: true, argv: process.argv, databaseHost: production.hostname });
    }
    await syncMenu(devMenu, production.prisma);
  assertMenuMatches(devMenu, await readMenu(production.prisma));
    console.log('Sincronización del menú finalizada. No se borraron registros exclusivos de producción.');
  } finally {
    await Promise.all([
      development.prisma.$disconnect(),
      production.prisma.$disconnect(),
      development.pool.end(),
      production.pool.end(),
    ]);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
