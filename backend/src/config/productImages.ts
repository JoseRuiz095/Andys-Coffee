import { z } from 'zod';

// Empty variables in .env files count as "not set".
const optionalString = z.preprocess((value) => (value === '' ? undefined : value), z.string().optional());

const schema = z.object({
  SUPABASE_URL: z.preprocess((value) => (value === '' ? undefined : value), z.string().url().optional()),
  // Backend only: Storage RLS rejects anonymous writes. Never expose it to the frontend.
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  PRODUCT_IMAGE_BUCKET: z.string().regex(/^[\w.-]+$/, 'PRODUCT_IMAGE_BUCKET inválido').default('Img'),
  PRODUCT_IMAGE_MAX_UPLOAD_MB: z.coerce.number().positive().max(25).default(10),
  PRODUCT_IMAGE_MAX_DIMENSION: z.coerce.number().int().min(200).max(4096).default(1200),
  PRODUCT_IMAGE_WEBP_QUALITY: z.coerce.number().int().min(40).max(100).default(80),
});

const env = schema.parse(process.env);

/**
 * Product images: uploaded by the API, converted to WebP and stored in Supabase Storage.
 * `imageUrl` in the database holds the object key inside the bucket (e.g.
 * "products/<productId>/<uuid>.webp"); the API turns it into the public URL.
 */
export const productImageConfig = {
  supabaseUrl: env.SUPABASE_URL?.replace(/\/+$/, ''),
  serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: env.PRODUCT_IMAGE_BUCKET,
  maxUploadBytes: Math.round(env.PRODUCT_IMAGE_MAX_UPLOAD_MB * 1024 * 1024),
  /** Longest side of the stored WebP. Larger images are scaled down, smaller ones kept. */
  maxDimension: env.PRODUCT_IMAGE_MAX_DIMENSION,
  webpQuality: env.PRODUCT_IMAGE_WEBP_QUALITY,
  /** Decompression-bomb guard: images above this pixel count are rejected before decoding. */
  maxInputPixels: 50_000_000,
  /** Smallest accepted side: below this the photo would look blurry on the menu. */
  minDimension: 100,
  /** Keys are unique per upload, so browsers and the CDN can cache them for a year. */
  cacheControlSeconds: 31_536_000,
};

/** Prefixes of objects the API created and may delete. Anything else (catalog images,
 * files uploaded by hand) is never deleted automatically. */
export const MANAGED_IMAGE_PREFIXES = ['products/', 'public/'] as const;
