import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';
import { UploadService } from '../services/upload.service';
import { z } from 'zod';
import { createProductSchema, filterQuerySchema, updateProductSchema } from '../validators/product.validator';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthUser } from '../services/auth.service';
import { AuthorizationError } from '../utils/errors';

const getAuthenticatedUser = (req: Request): AuthUser => {
  if (!req.user) {
    throw new AuthorizationError('Autenticación requerida.');
  }
  return req.user as AuthUser;
}

export const ProductController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const query = filterQuerySchema.parse(req.query);
    const result = await ProductService.findAll(query);
    res.status(200).json(result);
  }),

  findOne: asyncHandler(async (req: Request, res: Response) => {
    const product = await ProductService.findOne(req.params.id as string);
    if (!product) return res.status(404).json({ message: 'Producto no encontrado.' });
    res.status(200).json(product);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const productData = req.body as z.infer<typeof createProductSchema>;
    let uploadedImageUrl: string | undefined;

    try {
      if (req.file) {
        uploadedImageUrl = await UploadService.uploadProductImage(req.file);
        productData.imageUrl = uploadedImageUrl;
      }

      const newProduct = await ProductService.create(productData, user, req.id);
      res.status(201).json(newProduct);
    } catch (error) {
      if (uploadedImageUrl) await UploadService.deleteProductImage(uploadedImageUrl);
      throw error;
    }
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const productId = req.params.id as string;
    const productData = req.body as z.infer<typeof updateProductSchema>;
    let uploadedImageUrl: string | undefined;
    let previousImageUrl: string | null | undefined;

    try {
      if (req.file) {
        const existingProduct = await ProductService.findOne(productId);
        previousImageUrl = existingProduct?.imageUrl;
        uploadedImageUrl = await UploadService.uploadProductImage(req.file);
        productData.imageUrl = uploadedImageUrl;
      }

      const updatedProduct = await ProductService.update(productId, productData, user, req.id);
      if (uploadedImageUrl && previousImageUrl) {
        await UploadService.deleteProductImage(previousImageUrl);
      }
      res.status(200).json(updatedProduct);
    } catch (error) {
      if (uploadedImageUrl) await UploadService.deleteProductImage(uploadedImageUrl);
      throw error;
    }
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const productId = req.params.id as string;
    await ProductService.remove(productId, user, req.id);
    res.status(204).send();
  }),

  setActive: asyncHandler(async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const { isActive } = req.body as { isActive: boolean };
    const updated = await ProductService.update(req.params.id as string, { isActive }, user, req.id);
    res.status(200).json(updated);
  }),
};