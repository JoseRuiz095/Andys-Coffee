import { Request, Response } from 'express';
import { InventoryCountService } from '../services/inventory-count.service';
import { inventoryCountValidator } from '../validators/inventory-count.validator';
import { AuthUser } from '../services/auth.service';

export const InventoryCountController = {
  async createCount(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const count = await InventoryCountService.createCount(user);

      res.status(201).json({
        success: true,
        data: count,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        return res.status(403).json({ error: error.message });
      }

      throw error;
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };

      const count = await InventoryCountService.findById(id, user);

      res.json({
        success: true,
        data: count,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        return res.status(403).json({ error: error.message });
      }

      if (error instanceof Error && error.name === 'NotFoundError') {
        return res.status(404).json({ error: error.message });
      }

      throw error;
    }
  },

  async addItem(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { countId } = req.params as { countId: string };
      const { ingredientId, countedQuantity, notes } = req.body;

      const validation = inventoryCountValidator.addItem.safeParse({
        ingredientId,
        countedQuantity,
        notes,
      });

      if (!validation.success) {
        const errors = validation.error.flatten();
        return res.status(400).json({ error: 'Validación fallida', details: errors });
      }

      const item = await InventoryCountService.addItem(
        countId,
        validation.data.ingredientId,
        validation.data.countedQuantity,
        validation.data.notes || null,
        user,
      );

      res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        return res.status(403).json({ error: error.message });
      }

      if (error instanceof Error && error.name === 'NotFoundError') {
        return res.status(404).json({ error: error.message });
      }

      if (error instanceof Error && error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }

      throw error;
    }
  },

  async completeCount(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { countId } = req.params as { countId: string };

      const count = await InventoryCountService.completeCount(countId, user);

      res.json({
        success: true,
        data: count,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        return res.status(403).json({ error: error.message });
      }

      if (error instanceof Error && error.name === 'NotFoundError') {
        return res.status(404).json({ error: error.message });
      }

      if (error instanceof Error && error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }

      throw error;
    }
  },

  async applyAdjustments(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { countId } = req.params as { countId: string };

      const count = await InventoryCountService.applyAdjustments(countId, user);

      res.json({
        success: true,
        data: count,
        message: 'Ajustes aplicados correctamente',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        return res.status(403).json({ error: error.message });
      }

      if (error instanceof Error && error.name === 'NotFoundError') {
        return res.status(404).json({ error: error.message });
      }

      if (error instanceof Error && error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }

      throw error;
    }
  },
};
