import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const backendRoot = process.cwd();
if (!fs.existsSync(path.join(backendRoot, 'prisma/schema.prisma'))) {
  throw new Error('Ejecuta este comando desde backend/.');
}

function readDatabaseConfig(mode: 'development' | 'production') {
  const envPath = path.join(backendRoot, `.env.${mode}`);
  if (!fs.existsSync(envPath)) throw new Error(`No existe ${path.basename(envPath)}.`);
  const env = dotenv.parse(fs.readFileSync(envPath));
  const rawUrl = env.DIRECT_URL || env.DATABASE_URL;
  if (!rawUrl) throw new Error(`${path.basename(envPath)} no define DIRECT_URL ni DATABASE_URL.`);

  const url = new URL(rawUrl);
  const sslmode = url.searchParams.get('sslmode');
  if (!sslmode || !['require', 'verify-ca', 'verify-full'].includes(sslmode)) {
    throw new Error(`${path.basename(envPath)} debe usar una conexión PostgreSQL con SSL.`);
  }
  for (const key of ['sslmode', 'pgbouncer', 'connection_limit', 'pool_timeout']) url.searchParams.delete(key);

  const caPath = env.DATABASE_SSL_CA_PATH
    ? path.resolve(backendRoot, env.DATABASE_SSL_CA_PATH)
    : path.join(backendRoot, 'certs/prod-ca-2021.crt');
  const ca = env.DATABASE_SSL_CA || fs.readFileSync(caPath, 'utf8');
  const identity = `${decodeURIComponent(url.username)}@${url.hostname}:${url.port || '5432'}${url.pathname}`;
  return { connectionString: url.toString(), ca, identity };
}

function createDatabase(mode: 'development' | 'production') {
  const config = readDatabaseConfig(mode);
  const pool = new Pool({
    connectionString: config.connectionString,
    ssl: { rejectUnauthorized: true, ca: config.ca },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { prisma, pool, identity: config.identity };
}

async function appliedMigrations(db: PrismaClient) {
  return db.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name
    FROM _prisma_migrations
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ORDER BY migration_name
  `;
}

async function readMenu(db: PrismaClient) {
  const [categories, products, extras, productExtras, combos, promotions] = await Promise.all([
    db.category.findMany({ orderBy: { displayOrder: 'asc' } }),
    db.product.findMany({ include: { category: { select: { name: true } } }, orderBy: [{ categoryId: 'asc' }, { displayOrder: 'asc' }] }),
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
  ]);
  return { categories, products, extras, productExtras, combos, promotions };
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
    categories: compare(source.categories, destination.categories, ({ name }) => name, ({ description, imageUrl, displayOrder, isActive }) => ({ description, imageUrl, displayOrder, isActive })),
    products: compare(source.products, destination.products, ({ sku }) => sku, ({ category, name, description, imageUrl, temperature, price, jumboPrice, cost, isActive, displayOrder }) => ({
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
        },
        update: {
          description: category.description,
          imageUrl: category.imageUrl,
          displayOrder: category.displayOrder,
          isActive: category.isActive,
        },
      });
      categoryIds.set(category.name, saved.id);
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
      };
      const saved = await tx.product.upsert({
        where: { sku: product.sku },
        create: { ...data, sku: product.sku },
        update: data,
      });
      productIds.set(product.sku, saved.id);
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
    });
    console.log(`Relaciones de extras en development: ${devMenu.productExtras.length}`);

    if (process.argv.includes('--verify')) {
      assertMenuMatches(devMenu, prodMenu);
      console.log('Verificación correcta: todos los elementos compartidos y sus relaciones coinciden.');
      return;
    }

    if (!apply) {
      console.log('Vista previa solamente. Para aplicar esta sincronización: npm run catalog:sync-menu:dev-to-prod -- --apply');
      return;
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
