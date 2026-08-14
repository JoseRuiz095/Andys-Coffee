import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';
import { createProductSchema, filterQuerySchema, updateProductSchema } from '../validators/product.validator';
import { asyncHandler } from '../utils/asyncHandler';

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
    const productData = createProductSchema.parse(req.body);
    const newProduct = await ProductService.create(productData);
    res.status(201).json(newProduct);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const productData = updateProductSchema.parse(req.body);
    const updatedProduct = await ProductService.update(req.params.id as string, productData);
    res.status(200).json(updatedProduct);
  }),
  // ... El método `remove` seguiría el mismo patrón
};