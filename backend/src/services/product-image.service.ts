import { ProductRepository } from '../repositories/product.repository';
import { ImageReferenceRepository } from '../repositories/image-reference.repository';
import { ImageStorageRepository } from '../repositories/image-storage.repository';
import { processProductImage } from './image-processing.service';
import type { AuthUser } from './auth.service';
import { AuthorizationError, ConflictError, NotFoundError } from '../utils/errors';
import { auditLog, logger } from '../utils/logger';
import { buildProductImageKey, isManagedKey, referenceVariants, resolveImageUrl, toStorageKey } from '../utils/imageKeys';

const IMAGE_CHANGED_MESSAGE = 'La imagen del producto cambió mientras se procesaba. Recarga e intenta de nuevo.';

/** What happened to the previous file after its reference was dropped. */
export type ReleaseOutcome = 'none' | 'kept' | 'shared' | 'deleted' | 'orphaned';

const ensurePermission = (user: AuthUser, permission: string) => {
  if (!user.permissions?.includes(permission)) {
    throw new AuthorizationError(`Permiso requerido: '${permission}'.`);
  }
};

/** Best-effort removal of a file that was uploaded but never referenced. */
async function discardUpload(key: string) {
  try {
    await ImageStorageRepository.get().remove(key);
  } catch (error) {
    logger.error({ key, message: error instanceof Error ? error.message : String(error) }, 'Orphan product image left in storage');
  }
}

export const ProductImageService = {
  /**
   * Replaces (or sets) a product's image: validate → WebP → upload under a new unique key →
   * swap the reference in the database → release the previous file. If anything fails before
   * the swap, the product keeps its previous image and the new file is removed.
   */
  async replace(productId: string, file: Buffer, user: AuthUser, requestId?: string) {
    ensurePermission(user, 'products.update');

    const product = await ProductRepository.findImageById(productId);
    if (!product) throw new NotFoundError('Producto no encontrado.');

    const processed = await processProductImage(file);
    const key = buildProductImageKey(product.id);
    await ImageStorageRepository.get().upload(key, processed.data, 'image/webp');

    let swapped: boolean;
    try {
      swapped = await ProductRepository.replaceImageIfUnchanged(product.id, product.imageUrl, key);
    } catch (error) {
      await discardUpload(key);
      throw error;
    }
    if (!swapped) {
      await discardUpload(key);
      throw new ConflictError(IMAGE_CHANGED_MESSAGE);
    }

    const previous = await this.release(product.imageUrl);
    auditLog({
      requestId,
      actor: { id: user.id, name: user.name },
      action: 'PRODUCT_IMAGE_UPDATED',
      entity: 'product',
      entityId: product.id,
      metadata: { from: product.imageUrl, to: key, previousFile: previous, bytes: processed.data.length },
    }, 'Product image updated');

    return {
      imageUrl: resolveImageUrl(key),
      width: processed.width,
      height: processed.height,
      bytes: processed.data.length,
      originalBytes: processed.originalBytes,
    };
  },

  /** Removes the product's image reference; the file goes too unless something else uses it. */
  async remove(productId: string, user: AuthUser, requestId?: string) {
    ensurePermission(user, 'products.update');

    const product = await ProductRepository.findImageById(productId);
    if (!product) throw new NotFoundError('Producto no encontrado.');
    if (!product.imageUrl) return;

    const swapped = await ProductRepository.replaceImageIfUnchanged(product.id, product.imageUrl, null);
    if (!swapped) throw new ConflictError(IMAGE_CHANGED_MESSAGE);

    const previous = await this.release(product.imageUrl);
    auditLog({
      requestId,
      actor: { id: user.id, name: user.name },
      action: 'PRODUCT_IMAGE_REMOVED',
      entity: 'product',
      entityId: product.id,
      metadata: { from: product.imageUrl, previousFile: previous },
    }, 'Product image removed');
  },

  /**
   * Deletes the file behind an image reference that was just dropped, only when it is an
   * upload made by the API and no product, combo or category still references it. Catalog
   * images, external URLs and shared files are kept. Never throws: the database is already
   * consistent, so a failed delete only leaves an orphan file (logged).
   */
  async release(stored: string | null | undefined): Promise<ReleaseOutcome> {
    if (!stored) return 'none';
    const key = toStorageKey(stored);
    if (!key || !isManagedKey(key)) return 'kept';
    try {
      if (await ImageReferenceRepository.count(referenceVariants(stored)) > 0) return 'shared';
      await ImageStorageRepository.get().remove(key);
      return 'deleted';
    } catch (error) {
      logger.error({ key, message: error instanceof Error ? error.message : String(error) }, 'Could not delete a released product image');
      return 'orphaned';
    }
  },
};
