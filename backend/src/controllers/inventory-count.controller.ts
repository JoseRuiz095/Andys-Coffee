import { Request, Response } from 'express';
import { z } from 'zod';
import { InventoryCountService } from '../services/inventory-count.service';
import { inventoryCountListSchema, inventoryCountValidator } from '../validators/inventory-count.validator';
import { AuthUser } from '../services/auth.service';

// Bodies arrive already validated by validate() in inventory-count.routes.ts; domain errors
// are mapped by the global errorHandler.
export const InventoryCountController = {
  async getAll(req: Request, res: Response) {
    const { page, limit, status, date } = inventoryCountListSchema.parse(req.query);
    res.json(await InventoryCountService.findAll(req.user as AuthUser, page, limit, status, date));
  },

  async createCount(req: Request, res: Response) {
    const count = await InventoryCountService.createCount(req.user as AuthUser);
    res.status(201).json({ success: true, data: count });
  },

  async findById(req: Request, res: Response) {
    const count = await InventoryCountService.findById(req.params.id as string, req.user as AuthUser);
    res.json({ success: true, data: count });
  },

  async addItem(req: Request, res: Response) {
    const { ingredientId, countedQuantity, notes } = req.body as z.infer<typeof inventoryCountValidator.addItem>;
    const item = await InventoryCountService.addItem(
      req.params.countId as string,
      ingredientId,
      countedQuantity,
      notes || null,
      req.user as AuthUser,
    );
    res.json({ success: true, data: item });
  },

  async removeItem(req: Request, res: Response) {
    const { countId, ingredientId } = req.params as { countId: string; ingredientId: string };
    await InventoryCountService.removeItem(countId, ingredientId, req.user as AuthUser);
    res.json({ success: true, message: 'Item eliminado del conteo.' });
  },

  async delete(req: Request, res: Response) {
    await InventoryCountService.deleteCount(req.params.id as string, req.user as AuthUser);
    res.json({ success: true, message: 'Conteo eliminado correctamente.' });
  },

  async completeCount(req: Request, res: Response) {
    const count = await InventoryCountService.completeCount(req.params.countId as string, req.user as AuthUser);
    res.json({ success: true, data: count });
  },

  async applyAdjustments(req: Request, res: Response) {
    const count = await InventoryCountService.applyAdjustments(req.params.countId as string, req.user as AuthUser);
    res.json({ success: true, data: count, message: 'Ajustes aplicados correctamente' });
  },
};
