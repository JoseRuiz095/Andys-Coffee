import sharp, { type Metadata } from 'sharp';
import { productImageConfig } from '../config/productImages';
import { ValidationError } from '../utils/errors';

/** Formats accepted as input, as detected by sharp from the bytes (not the client's MIME type).
 * "heif" covers AVIF; HEIC photos fail to decode and are rejected. */
const ACCEPTED_INPUT_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif']);

export type ProcessedImage = {
  data: Buffer;
  width: number;
  height: number;
  /** Size of the uploaded file, to report the savings. */
  originalBytes: number;
};

type ProcessOptions = Pick<
  typeof productImageConfig,
  'maxDimension' | 'webpQuality' | 'maxInputPixels' | 'minDimension'
>;

/**
 * Decodes an uploaded image, fixes its EXIF orientation, scales it down to `maxDimension`
 * and re-encodes it as WebP. Anything that is not a valid, supported image is rejected
 * with a 400 (ValidationError); the output is always a WebP produced here.
 */
export async function processProductImage(input: Buffer, options: ProcessOptions = productImageConfig): Promise<ProcessedImage> {
  const decoderOptions = { limitInputPixels: options.maxInputPixels };

  let metadata: Metadata;
  try {
    metadata = await sharp(input, decoderOptions).metadata();
  } catch {
    throw new ValidationError('El archivo no es una imagen válida o está dañado.');
  }

  if (!metadata.format || !ACCEPTED_INPUT_FORMATS.has(metadata.format)) {
    throw new ValidationError('Formato no admitido. Usa una imagen JPEG, PNG, WebP o AVIF.');
  }
  if (!metadata.width || !metadata.height) {
    throw new ValidationError('No se pudieron leer las dimensiones de la imagen.');
  }
  if (metadata.width * metadata.height > options.maxInputPixels) {
    throw new ValidationError('La imagen tiene demasiados píxeles. Redúcela antes de subirla.');
  }
  if (Math.min(metadata.width, metadata.height) < options.minDimension) {
    throw new ValidationError(`La imagen debe medir al menos ${options.minDimension} px por lado.`);
  }

  try {
    const { data, info } = await sharp(input, decoderOptions)
      .rotate() // applies the EXIF orientation; metadata is not copied to the output
      .resize({
        width: options.maxDimension,
        height: options.maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: options.webpQuality, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (info.format !== 'webp') {
      throw new Error(`Unexpected output format ${info.format}`);
    }
    return { data, width: info.width, height: info.height, originalBytes: input.length };
  } catch {
    // Truncated or corrupt data usually passes the header check and fails here.
    throw new ValidationError('No se pudo procesar la imagen. Verifica que el archivo no esté dañado.');
  }
}
