import { Request, Response } from 'express';
import type { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ProductFamilyService } from '../services/product-family.service';
import type { createProductFamilySchema, updateProductFamilySchema } from '../validators/product-family.validator';

export const ProductFamilyController = {
  findAll: asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await ProductFamilyService.findAll());
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await ProductFamilyService.create(req.body as z.infer<typeof createProductFamilySchema>));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await ProductFamilyService.update(String(req.params.id), req.body as z.infer<typeof updateProductFamilySchema>));
  }),
};
