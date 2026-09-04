import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';
import { UploadService } from '../services/upload.service'; 
import { createProductSchema, filterQuerySchema, updateProductSchema } from '../validators/product.validator';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthUser } from '../services/auth.service';

// Custom error for authorization
class AuthorizationError extends Error {
  constructor(message = 'Acción no autorizada.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

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
    const productData = createProductSchema.parse(req.body);

    if (req.file) {
      const imageUrl = await UploadService.uploadProductImage(req.file);
      productData.imageUrl = imageUrl;
    }

    const newProduct = await ProductService.create(productData, user);
    res.status(201).json(newProduct);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const productId = req.params.id as string;
    const productData = updateProductSchema.parse(req.body);

    if (req.file) {
      const existingProduct = await ProductService.findOne(productId);
      const imageUrl = await UploadService.uploadProductImage(req.file);
      productData.imageUrl = imageUrl;

      if (existingProduct?.imageUrl) {
        await UploadService.deleteProductImage(existingProduct.imageUrl);
      }
    }

    const updatedProduct = await ProductService.update(productId, productData, user);
    res.status(200).json(updatedProduct);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const productId = req.params.id as string;
    await ProductService.remove(productId, user);
    res.status(204).send();
  }),
};