import { Request, Response } from 'express';
import { CategoryService } from '../services/category.service';
import { createCategorySchema, updateCategorySchema, setActiveSchema } from '../validators/category.validator';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthUser } from '../services/auth.service';
import { AuthorizationError } from '../utils/errors';

const getAuthenticatedUser = (req: Request): AuthUser => {
  if (!req.user) {
    throw new AuthorizationError('Autenticación requerida.');
  }
  return req.user as AuthUser;
};

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
    const data = createCategorySchema.parse(req.body);
    const category = await CategoryService.create(
      data.name,
      data.description || undefined,
      data.imageUrl || undefined,
      data.displayOrder
    );
    res.status(201).json(category);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = updateCategorySchema.parse(req.body);
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
    const { isActive } = setActiveSchema.parse(req.body);
    const updated = await CategoryService.setActive(req.params.id as string, isActive);
    res.status(200).json(updated);
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    await CategoryService.delete(req.params.id as string);
    res.status(204).send();
  }),
};
