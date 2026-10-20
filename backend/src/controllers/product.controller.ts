import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';
import { z } from 'zod';
import { createProductSchema, filterQuerySchema, updateProductSchema } from '../validators/product.validator';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthUser } from '../services/auth.service';
import { AuthorizationError, ValidationError } from '../utils/errors';
import { ProductImageService } from '../services/product-image.service';

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
    const newProduct = await ProductService.create(productData, user, req.id);
    res.status(201).json(newProduct);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const productData = req.body as z.infer<typeof updateProductSchema>;
    const updatedProduct = await ProductService.update(req.params.id as string, productData, user, req.id);
    res.status(200).json(updatedProduct);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const productId = req.params.id as string;
    await ProductService.remove(productId, user, req.id);
    res.status(204).send();
  }),

  /** Multipart field "image"; the service validates and converts it to WebP. */
  uploadImage: asyncHandler(async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!req.file) throw new ValidationError('Selecciona una imagen para subir (campo "image").');
    const result = await ProductImageService.replace(req.params.id as string, req.file.buffer, user, req.id);
    res.status(200).json(result);
  }),

  removeImage: asyncHandler(async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    await ProductImageService.remove(req.params.id as string, user, req.id);
    res.status(204).send();
  }),

  setActive: asyncHandler(async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const { isActive } = req.body as { isActive: boolean };
    const updated = await ProductService.update(req.params.id as string, { isActive }, user, req.id);
    res.status(200).json(updated);
  }),
};