import { Request, Response } from 'express';
import { z } from 'zod';
import { InventoryService } from '../services/inventory.service';
import { inventoryListSchema, inventoryMovementsSchema, inventoryExitSchema, ingredientCreateSchema, ingredientUpdateSchema } from '../validators/inventory.validator';
import { searchQuerySchema } from '../validators/common.validator';
import { AuthUser } from '../services/auth.service';

// Bodies arrive already validated by validate() in inventory.routes.ts; domain errors
// (403/404/409/DuplicateError) are mapped by the global errorHandler.
export const InventoryController = {
  async search(req: Request, res: Response) {
    const { q } = searchQuerySchema.parse(req.query);
    res.json(await InventoryService.search(q, req.user as AuthUser));
  },

  async getAll(req: Request, res: Response) {
    const query = inventoryListSchema.parse(req.query);
    res.json(await InventoryService.findAll(query, req.user as AuthUser));
  },

  async getOne(req: Request, res: Response) {
    res.json(await InventoryService.findOne(req.params.id as string, req.user as AuthUser));
  },

  async getBySku(req: Request, res: Response) {
    res.json(await InventoryService.findBySku(req.params.sku as string, req.user as AuthUser));
  },

  async getMovements(req: Request, res: Response) {
    const query = inventoryMovementsSchema.parse(req.query);
    res.json(await InventoryService.getMovements(query, req.user as AuthUser));
  },

  async getLowStock(req: Request, res: Response) {
    res.json(await InventoryService.getLowStock(req.user as AuthUser));
  },

  async getSummary(req: Request, res: Response) {
    res.json(await InventoryService.getSummary(req.user as AuthUser));
  },

  async getTotalValue(req: Request, res: Response) {
    const totalValue = await InventoryService.getTotalValue(req.user as AuthUser);
    res.json({ totalValue: totalValue.toFixed(2) });
  },

  async createExit(req: Request, res: Response) {
    const data = req.body as z.infer<typeof inventoryExitSchema>;
    res.status(201).json(await InventoryService.createExit(data, req.user as AuthUser));
  },

  async create(req: Request, res: Response) {
    const data = req.body as z.infer<typeof ingredientCreateSchema>;
    const ingredient = await InventoryService.createIngredient(data, req.user as AuthUser);
    res.status(201).json({ success: true, message: 'Ingrediente creado correctamente.', ingredient });
  },

  async update(req: Request, res: Response) {
    const data = req.body as z.infer<typeof ingredientUpdateSchema>;
    const ingredient = await InventoryService.updateIngredient(req.params.id as string, data, req.user as AuthUser);
    res.json({ success: true, message: 'Ingrediente actualizado correctamente.', ingredient });
  },

  async setActive(req: Request, res: Response) {
    const { isActive } = req.body as { isActive: boolean };
    const ingredient = await InventoryService.setIngredientActive(req.params.id as string, isActive, req.user as AuthUser);
    res.json({
      success: true,
      message: `Ingrediente ${isActive ? 'activado' : 'desactivado'} correctamente.`,
      ingredient,
    });
  },

  async delete(req: Request, res: Response) {
    await InventoryService.deleteIngredient(req.params.id as string, req.user as AuthUser);
    res.json({ success: true, message: 'Ingrediente eliminado correctamente.' });
  },

  async getUnits(req: Request, res: Response) {
    res.json(await InventoryService.getUnits(req.user as AuthUser));
  },
};
