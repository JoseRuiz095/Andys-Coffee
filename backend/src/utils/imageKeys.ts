import { randomUUID } from 'node:crypto';
import { MANAGED_IMAGE_PREFIXES, productImageConfig } from '../config/productImages';

const PUBLIC_OBJECT_PATH = '/storage/v1/object/public/';

type KeyConfig = Pick<typeof productImageConfig, 'supabaseUrl' | 'bucket'>;

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

/**
 * Bucket key of a stored `imageUrl`. Older rows hold the full public URL of an object in this
 * bucket; newer ones the key itself. Returns null for URLs outside the bucket (never managed).
 */
export function toStorageKey(stored: string | null | undefined, config: KeyConfig = productImageConfig): string | null {
  if (!stored) return null;
  if (!isAbsoluteUrl(stored)) {
    const key = stored.replace(/^\/+/, '');
    return key && !key.split('/').includes('..') ? key : null;
  }
  if (!config.supabaseUrl) return null;
  let url: URL;
  try {
    url = new URL(stored);
  } catch {
    return null;
  }
  const prefix = `${PUBLIC_OBJECT_PATH}${config.bucket}/`;
  if (url.origin !== new URL(config.supabaseUrl).origin || !url.pathname.startsWith(prefix)) return null;
  const key = decodeURIComponent(url.pathname.slice(prefix.length));
  return key && !key.split('/').includes('..') ? key : null;
}

/** Public URL of a bucket key. */
export function publicUrlForKey(key: string, config: KeyConfig = productImageConfig): string | null {
  if (!config.supabaseUrl) return null;
  const encoded = key.split('/').map(encodeURIComponent).join('/');
  return `${config.supabaseUrl}${PUBLIC_OBJECT_PATH}${config.bucket}/${encoded}`;
}

/** What the API returns for a stored `imageUrl`: absolute URLs as-is, keys as public URLs. */
export function resolveImageUrl(stored: string | null | undefined, config: KeyConfig = productImageConfig): string | null {
  if (!stored) return null;
  if (isAbsoluteUrl(stored)) return stored;
  const key = toStorageKey(stored, config);
  return key ? publicUrlForKey(key, config) : null;
}

/** Only objects the API uploaded may be deleted by it. */
export function isManagedKey(key: string): boolean {
  return MANAGED_IMAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Server-generated, unique key: never derived from the client's file name. */
export function buildProductImageKey(productId: string): string {
  if (!/^[\w-]+$/.test(productId)) throw new Error('Invalid product id for an image key.');
  return `products/${productId}/${randomUUID()}.webp`;
}

/** Every form in which a row may reference the object behind `stored` (key and public URL). */
export function referenceVariants(stored: string, config: KeyConfig = productImageConfig): string[] {
  const key = toStorageKey(stored, config);
  if (!key) return [stored];
  const url = publicUrlForKey(key, config);
  return [...new Set([stored, key, ...(url ? [url] : [])])];
}
