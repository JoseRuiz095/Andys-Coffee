import { Request, Response } from 'express';
import type { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ExtraService } from '../services/extra.service';
import type { createExtraSchema, setActiveSchema, setProductExtrasSchema, updateExtraSchema } from '../validators/extra.validator';

export const ExtraController = {
  findAll: asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await ExtraService.findAll());
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await ExtraService.create(req.body as z.infer<typeof createExtraSchema>));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await ExtraService.update(String(req.params.id), req.body as z.infer<typeof updateExtraSchema>));
  }),

  setActive: asyncHandler(async (req: Request, res: Response) => {
    const { isActive } = req.body as z.infer<typeof setActiveSchema>;
    res.status(200).json(await ExtraService.setActive(String(req.params.id), isActive));
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await ExtraService.delete(String(req.params.id));
    res.status(204).send();
  }),

  setProductExtras: asyncHandler(async (req: Request, res: Response) => {
    const { extraIds } = req.body as z.infer<typeof setProductExtrasSchema>;
    res.status(200).json(await ExtraService.setProductExtras(String(req.params.id), extraIds));
  }),
};
