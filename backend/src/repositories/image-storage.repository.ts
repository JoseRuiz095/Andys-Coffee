import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { productImageConfig } from '../config/productImages';
import { ServiceUnavailableError, StorageError } from '../utils/errors';
import { logger } from '../utils/logger';

/** Object storage for product images (Supabase Storage in production, a fake in tests). */
export interface ImageStorage {
  /** Stores a new object; fails if the key already exists (never overwrites). */
  upload(key: string, data: Buffer, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
}

let client: SupabaseClient | null = null;
let override: ImageStorage | null = null;

function getClient(): SupabaseClient {
  const { supabaseUrl, serviceRoleKey } = productImageConfig;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new ServiceUnavailableError(
      'El almacenamiento de imágenes no está configurado (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).',
    );
  }
  client ??= createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

const supabaseStorage: ImageStorage = {
  async upload(key, data, contentType) {
    const { error } = await getClient().storage.from(productImageConfig.bucket).upload(key, data, {
      contentType,
      upsert: false,
      cacheControl: String(productImageConfig.cacheControlSeconds),
    });
    if (error) {
      // Only the message: the raw error may carry request details from the client.
      logger.error({ message: error.message, key }, 'Supabase Storage rejected an image upload');
      throw new StorageError();
    }
  },

  async remove(key) {
    const { error } = await getClient().storage.from(productImageConfig.bucket).remove([key]);
    if (error) {
      logger.error({ message: error.message, key }, 'Supabase Storage rejected an image removal');
      throw new StorageError('No se pudo eliminar la imagen del almacenamiento.');
    }
  },
};

export const ImageStorageRepository = {
  get(): ImageStorage {
    return override ?? supabaseStorage;
  },

  /** Tests replace the provider with an in-memory fake; null restores Supabase. */
  setForTests(storage: ImageStorage | null) {
    override = storage;
  },
};
