/**
 * Client-side hints for product photos. The backend is the source of truth: it checks the real
 * format and size and converts every upload to WebP (PRODUCT_IMAGE_* in backend/.env).
 */
export const PRODUCT_IMAGE_MAX_MB = 10
export const PRODUCT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif'
