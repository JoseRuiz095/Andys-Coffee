import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { productImageConfig } from '../config/productImages';
import { ValidationError } from '../utils/errors';

/**
 * One image in the multipart field "image", kept in memory up to the configured limit (the
 * file is re-encoded right away, never written to the container's ephemeral disk). The MIME
 * check is only a quick filter: the real format is detected from the bytes by sharp.
 */
export const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: productImageConfig.maxUploadBytes,
    files: 1,
    fields: 0,
    parts: 1,
  },
  fileFilter: (_req, file, callback) => {
    const mime = file.mimetype.toLowerCase();
    if (!mime.startsWith('image/') && mime !== 'application/octet-stream') {
      callback(new ValidationError('Solo se permiten archivos de imagen (JPEG, PNG, WebP o AVIF).'));
      return;
    }
    callback(null, true);
  },
}).single('image');

/** Image processing is CPU-heavy: at most 30 uploads per user every 15 minutes. */
export const productImageUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? 'anonymous',
  handler: (_req, res) => {
    res.status(429).json({ message: 'Demasiadas imágenes subidas en poco tiempo. Intenta de nuevo en unos minutos.' });
  },
});
