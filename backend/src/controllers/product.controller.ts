import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';
// Asumimos que tienes un servicio para manejar la subida de archivos
import { UploadService } from '../services/upload.service'; 
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

    if (req.file) {
      // Si hay un archivo, lo subimos y obtenemos la URL
      const imageUrl = await UploadService.uploadProductImage(req.file);
      productData.imageUrl = imageUrl;
    }

    const newProduct = await ProductService.create(productData);
    res.status(201).json(newProduct);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.id as string;
    const productData = updateProductSchema.parse(req.body);

    if (req.file) {
      // 1. Buscamos el producto existente para obtener la URL de la imagen antigua.
      const existingProduct = await ProductService.findOne(productId);

      // 2. Subimos la nueva imagen.
      const imageUrl = await UploadService.uploadProductImage(req.file);
      productData.imageUrl = imageUrl;

      // 3. Si había una imagen antigua, la eliminamos de Supabase.
      if (existingProduct?.imageUrl) {
        await UploadService.deleteProductImage(existingProduct.imageUrl);
      }
    }

    const updatedProduct = await ProductService.update(productId, productData);
    res.status(200).json(updatedProduct);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.id as string;
    // El ProductService.remove ya se encarga de borrar la imagen de Supabase.
    await ProductService.remove(productId);
    res.status(204).send();
  }),
};