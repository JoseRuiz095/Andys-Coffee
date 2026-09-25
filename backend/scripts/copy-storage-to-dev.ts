/**
 * Copies the product-image bucket from the production Supabase project (.env.production) to
 * the development one (.env.development), so the catalog loaded in the development database
 * shows its images. Production is only READ (list + download); files that already exist in
 * development are skipped.
 *
 *   cd backend && npx tsx scripts/copy-storage-to-dev.ts --dry-run   # only lists what it would copy
 *   cd backend && npx tsx scripts/copy-storage-to-dev.ts
 *
 * Both files need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The script reads them directly
 * and ignores NODE_ENV and the variables of the terminal.
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PRODUCT_IMAGE_BUCKET } from '../src/config/storage';

const dryRun = process.argv.includes('--dry-run');

function projectFromEnvFile(file: string) {
  const fullPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(fullPath)) throw new Error(`No existe ${file} (ejecuta el script desde backend/).`);
  const env = dotenv.parse(fs.readFileSync(fullPath));
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`${file} necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.`);
  }
  return {
    url: env.SUPABASE_URL,
    client: createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}

/** Every file path in the bucket (folders are listed recursively). */
async function listFiles(client: SupabaseClient, prefix = ''): Promise<string[]> {
  const files: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.storage.from(PRODUCT_IMAGE_BUCKET).list(prefix, { limit: pageSize, offset });
    if (error) throw new Error(`No se pudo listar "${prefix || '/'}": ${error.message}`);
    for (const item of data) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      // Folders come back without id; placeholder files keep empty folders alive.
      if (item.id === null) files.push(...(await listFiles(client, itemPath)));
      else if (item.name !== '.emptyFolderPlaceholder') files.push(itemPath);
    }
    if (data.length < pageSize) return files;
  }
}

async function main() {
  const production = projectFromEnvFile('.env.production');
  const development = projectFromEnvFile('.env.development');
  if (production.url === development.url) {
    throw new Error('.env.development y .env.production usan el mismo proyecto de Supabase: no hay nada que copiar.');
  }
  process.stdout.write(`Origen (solo lectura): ${production.url}\nDestino: ${development.url}\nBucket: ${PRODUCT_IMAGE_BUCKET}${dryRun ? '  [--dry-run]' : ''}\n\n`);

  const { data: buckets, error: bucketsError } = await development.client.storage.listBuckets();
  if (bucketsError) throw new Error(`No se pudieron leer los buckets de desarrollo: ${bucketsError.message}`);
  if (!buckets.some((bucket) => bucket.name === PRODUCT_IMAGE_BUCKET)) {
    process.stdout.write(`El bucket "${PRODUCT_IMAGE_BUCKET}" no existe en desarrollo: se crea como público.\n`);
    if (!dryRun) {
      const { error } = await development.client.storage.createBucket(PRODUCT_IMAGE_BUCKET, { public: true });
      if (error) throw new Error(`No se pudo crear el bucket: ${error.message}`);
    }
  }

  const sourceFiles = await listFiles(production.client);
  const existing = new Set(dryRun && !buckets.some((b) => b.name === PRODUCT_IMAGE_BUCKET) ? [] : await listFiles(development.client));
  const pending = sourceFiles.filter((file) => !existing.has(file));
  process.stdout.write(`${sourceFiles.length} archivos en producción, ${sourceFiles.length - pending.length} ya estaban en desarrollo, ${pending.length} por copiar.\n`);

  let copied = 0;
  const failed: string[] = [];
  for (const file of pending) {
    if (dryRun) {
      process.stdout.write(`  copiaría ${file}\n`);
      continue;
    }
    const { data: blob, error: downloadError } = await production.client.storage.from(PRODUCT_IMAGE_BUCKET).download(file);
    if (downloadError || !blob) {
      failed.push(`${file} (descarga: ${downloadError?.message ?? 'vacío'})`);
      continue;
    }
    const { error: uploadError } = await development.client.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(file, Buffer.from(await blob.arrayBuffer()), { contentType: blob.type || undefined, upsert: false });
    if (uploadError) failed.push(`${file} (subida: ${uploadError.message})`);
    else copied += 1;
  }

  if (!dryRun) process.stdout.write(`\nCopiados: ${copied}.\n`);
  if (failed.length > 0) {
    process.stdout.write(`Fallaron ${failed.length}:\n- ${failed.join('\n- ')}\n`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
