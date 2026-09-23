import { Request, Response } from 'express';
import { z } from 'zod';
import { CategoryService } from '../services/category.service';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validator';
import { asyncHandler } from '../utils/asyncHandler';

export const CategoryController = {
  getAll: asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const includeInactive = req.query.includeInactive === 'true';
    const result = await CategoryService.getAll(page, limit, includeInactive);
    res.json({ categories: result.categories, total: result.total });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const category = await CategoryService.getById(req.params.id as string);
    res.json(category);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = req.body as z.infer<typeof createCategorySchema>;
    const category = await CategoryService.create(
      data.name,
      data.description || undefined,
      data.imageUrl || undefined,
      data.displayOrder
    );
    res.status(201).json(category);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = req.body as z.infer<typeof updateCategorySchema>;
    const category = await CategoryService.update(
      req.params.id as string,
      data.name,
      data.description || undefined,
      data.imageUrl || undefined,
      data.displayOrder,
    );
    res.json(category);
  }),

  setActive: asyncHandler(async (req: Request, res: Response) => {
    const { isActive } = req.body as { isActive: boolean };
    const updated = await CategoryService.setActive(req.params.id as string, isActive);
    res.status(200).json(updated);
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    await CategoryService.delete(req.params.id as string);
    res.status(204).send();
  }),
};
