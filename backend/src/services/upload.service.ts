import { supabase } from '../config/supabase';
import { PRODUCT_IMAGE_BUCKET } from '../config/storage';
import { v4 as uuidv4 } from 'uuid';
import sharp, { type Metadata } from 'sharp';
import { logger } from '../utils/logger';

const BUCKET_NAME = PRODUCT_IMAGE_BUCKET;
const MAX_IMAGE_DIMENSION = 4096;

class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

export const UploadService = {
  /**
   * Sube la imagen de un producto a Supabase Storage.
   * @param file El archivo recibido por multer.
   * @returns La URL pública de la imagen subida.
   */
  async uploadProductImage(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new UploadValidationError('No se proporcionó ningún archivo para subir.');
    }

    let metadata: Metadata;
    try {
      metadata = await sharp(file.buffer, { limitInputPixels: MAX_IMAGE_DIMENSION ** 2 }).metadata();
    } catch {
      throw new UploadValidationError('El archivo no contiene una imagen válida.');
    }
    const formatToMime: Record<string, string> = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    const detectedMime = metadata.format ? formatToMime[metadata.format] : undefined;

    if (!detectedMime || detectedMime !== file.mimetype) {
      throw new UploadValidationError('El contenido de la imagen no coincide con un formato permitido.');
    }
    if (!metadata.width || !metadata.height || metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
      throw new UploadValidationError(`La imagen no puede superar ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} píxeles.`);
    }

    const fileName = `${uuidv4()}.${metadata.format}`;
    // Guardamos los archivos en una carpeta 'public' dentro del bucket para que sean accesibles.
    const filePath = `public/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      // Logged for diagnosis; the client gets a clear, non-technical message (409 via errorHandler).
      logger.error({ message: uploadError.message }, 'Supabase Storage rejected the product image upload');
      const error = new Error('No se pudo guardar la imagen. Revisa la configuración de almacenamiento (SUPABASE_SERVICE_ROLE_KEY) o intenta de nuevo.');
      error.name = 'BusinessRuleError';
      throw error;
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  },

  /**
   * Elimina una imagen de producto de Supabase Storage usando su URL.
   * @param imageUrl La URL pública de la imagen a eliminar.
   */
  async deleteProductImage(imageUrl: string | null | undefined): Promise<void> {
    if (!imageUrl) return;

    try {
      const url = new URL(imageUrl);
      const path = url.pathname.split(`/${BUCKET_NAME}/`)[1];

      if (path && path.startsWith('public/')) {
        const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
        if (error) throw error;
      }
    } catch (error) {
      // Only the message is logged (not the raw error object), which could otherwise
      // include request/response details from the Supabase client.
      logger.error({ message: error instanceof Error ? error.message : String(error) }, 'Error al eliminar la imagen de Supabase');
    }
  },
};