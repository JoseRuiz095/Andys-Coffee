import { supabase } from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';

const BUCKET_NAME = 'Img';

export const UploadService = {
  /**
   * Sube la imagen de un producto a Supabase Storage.
   * @param file El archivo recibido por multer.
   * @returns La URL pública de la imagen subida.
   */
  async uploadProductImage(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new Error('No se proporcionó ningún archivo para subir.');
    }

    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    // Guardamos los archivos en una carpeta 'public' dentro del bucket para que sean accesibles.
    const filePath = `public/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Error al subir el archivo a Supabase: ${uploadError.message}`);
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

      if (path) {
        await supabase.storage.from(BUCKET_NAME).remove([path]);
      }
    } catch (error) {
      console.error('Error al eliminar la imagen de Supabase:', error);
    }
  },
};