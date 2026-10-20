/**
 * Moves the menu photos to Supabase Storage as WebP and points products, combos and categories
 * at them, keeping every existing assignment (rules in planImageMigration, prisma/menu-images.ts).
 *
 *   npm run images:migrate                  # dry run against .env.development (changes nothing)
 *   npm run images:migrate -- --apply       # backup → upload catalog files → update rows
 *   npm run images:migrate:prod -- --apply  # same, against .env.production
 *   npm run images:migrate -- --restore prisma/backups/menu-images-<fecha>.json
 *
 * Nothing is deleted: old bucket files ("Menu/…", "public/…") stay where they are. Uploads never
 * overwrite (upsert: false). Row updates are compare-and-set, so a value changed by the app in
 * the meantime is left alone. --apply writes a JSON backup first; --restore puts its values back.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../src/config/prisma";
import { productImageConfig } from "../src/config/productImages";
import { toStorageKey } from "../src/utils/imageKeys";
import { catalogKey, LEGACY_PLACEHOLDERS, MENU_IMAGES_DIR, planImageMigration, type ImageRow } from "../prisma/menu-images";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const restoreIndex = args.indexOf("--restore");
const restoreFile = restoreIndex >= 0 ? args[restoreIndex + 1] : undefined;

function listCatalog(): string[] {
  return fs
    .readdirSync(MENU_IMAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((folder) =>
      fs
        .readdirSync(path.join(MENU_IMAGES_DIR, folder.name))
        .filter((file) => file.endsWith(".webp"))
        .map((file) => `${folder.name}/${file.slice(0, -".webp".length)}`),
    )
    .sort();
}

async function loadRows(): Promise<ImageRow[]> {
  const [products, combos, categories] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true, sku: true, imageUrl: true }, orderBy: { sku: "asc" } }),
    prisma.combo.findMany({ select: { id: true, name: true, imageUrl: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ select: { id: true, name: true, imageUrl: true }, orderBy: { name: "asc" } }),
  ]);
  return [
    ...products.map((row) => ({ table: "product" as const, ...row })),
    ...combos.map((row) => ({ table: "combo" as const, ...row })),
    ...categories.map((row) => ({ table: "category" as const, ...row })),
  ];
}

/** Compare-and-set: only writes when the row still holds `from`. */
async function setImage(row: ImageRow, from: string | null, to: string | null): Promise<boolean> {
  const where = { id: row.id, imageUrl: from };
  const data = { imageUrl: to };
  const result =
    row.table === "product"
      ? await prisma.product.updateMany({ where, data })
      : row.table === "combo"
        ? await prisma.combo.updateMany({ where, data })
        : await prisma.category.updateMany({ where, data });
  return result.count === 1;
}

function storageBucket() {
  const { supabaseUrl, serviceRoleKey, bucket } = productImageConfig;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el .env de este entorno.");
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    .storage.from(bucket);
}

async function restore(file: string) {
  const backup = JSON.parse(fs.readFileSync(path.resolve(file), "utf8")) as { rows: ImageRow[] };
  const current = new Map((await loadRows()).map((row) => [`${row.table}:${row.id}`, row]));
  let restored = 0;
  for (const saved of backup.rows) {
    const now = current.get(`${saved.table}:${saved.id}`);
    if (!now || now.imageUrl === saved.imageUrl) continue;
    if (await setImage(now, now.imageUrl, saved.imageUrl)) {
      restored++;
      console.log(`  ${saved.table} ${saved.name}: ${now.imageUrl ?? "—"} → ${saved.imageUrl ?? "—"}`);
    }
  }
  console.log(`\nRestaurados: ${restored}`);
}

async function main() {
  const host = (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "").replace(/\/\/[^@]*@/, "//***@");
  console.log(`BD: ${host}`);
  console.log(`Bucket: ${productImageConfig.bucket} en ${productImageConfig.supabaseUrl ?? "(SUPABASE_URL sin definir)"}\n`);

  if (restoreFile) return restore(restoreFile);

  const catalog = listCatalog();
  const rows = await loadRows();
  const decisions = planImageMigration(rows, catalog, (stored) => toStorageKey(stored));

  const labels = { migrate: "MIGRAR", assign: "ASIGNAR", keep: "conservar", unresolved: "SIN CORRESPONDENCIA" };
  for (const { row, action, to, reason } of decisions) {
    console.log(`[${labels[action]}] ${row.table} ${row.sku ?? ""} ${row.name}: ${row.imageUrl ?? "—"}${to ? ` → ${to}` : ""}  (${reason})`);
  }

  const changes = decisions.filter((decision) => decision.to);
  const finalValues = new Set(decisions.map((decision) => decision.to ?? decision.row.imageUrl));
  const unused = catalog.filter((image) => !finalValues.has(catalogKey(image)));
  const withoutImage = decisions.filter((decision) => {
    const final = decision.to ?? decision.row.imageUrl;
    return decision.row.table === "product" && (!final || LEGACY_PLACEHOLDERS.has(final.toLowerCase()));
  });
  console.log(`\nCambios: ${changes.length} · sin correspondencia: ${decisions.filter((d) => d.action === "unresolved").length}`);
  console.log(`Fotos del catálogo sin producto: ${unused.join(", ") || "ninguna"}`);
  console.log(`Productos que quedan sin imagen: ${withoutImage.map((d) => d.row.name).join(", ") || "ninguno"}`);

  if (!apply) {
    console.log("\nSimulación: no se cambió nada. Ejecuta con --apply para aplicar.");
    return;
  }

  const backupDir = path.resolve("prisma/backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `menu-images-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ createdAt: new Date().toISOString(), host, rows }, null, 2));
  console.log(`\nRespaldo: ${backupFile}`);

  const bucket = storageBucket();
  let uploaded = 0;
  let existing = 0;
  for (const image of catalog) {
    const data = fs.readFileSync(path.join(MENU_IMAGES_DIR, `${image}.webp`));
    const { error } = await bucket.upload(catalogKey(image), data, {
      contentType: "image/webp",
      upsert: false,
      cacheControl: String(productImageConfig.cacheControlSeconds),
    });
    if (!error) uploaded++;
    else if (/exist|duplicate/i.test(error.message)) existing++;
    else throw new Error(`No se pudo subir ${image}: ${error.message}. La base de datos no se modificó.`);
  }
  console.log(`Catálogo: ${uploaded} subidas, ${existing} ya existían`);

  let updated = 0;
  const conflicts: string[] = [];
  for (const decision of changes) {
    if (await setImage(decision.row, decision.row.imageUrl, decision.to ?? null)) updated++;
    else conflicts.push(`${decision.row.table} ${decision.row.name}`);
  }
  console.log(`Filas actualizadas: ${updated}`);
  if (conflicts.length > 0) console.log(`Cambiaron durante la migración (no se tocaron): ${conflicts.join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
