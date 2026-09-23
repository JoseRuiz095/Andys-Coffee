import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import { InventoryService } from '../services/inventory.service';
import { inventoryListSchema, inventoryMovementsSchema, inventoryExitSchema, ingredientCreateSchema, ingredientUpdateSchema } from '../validators/inventory.validator';
import { AuthUser } from '../services/auth.service';
import { DuplicateError } from '../utils/errors';
import { sendDuplicateErrorResponse } from '../utils/controllerErrors';

export const InventoryController = {
  async search(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { q } = req.query as { q?: string };

      if (!q) {
        res.status(400).json({ message: 'Parámetro de búsqueda requerido: q' });
        return;
      }

      const results = await InventoryService.search(q, user);

      res.json(results);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ message: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({ message: error.message });
        return;
      }

      throw error;
    }
  },

  async getAll(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const query = inventoryListSchema.parse(req.query);

      const result = await InventoryService.findAll(query, user);

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: 'Parámetros de búsqueda inválidos',
          errors: error.flatten().fieldErrors,
        });
        return;
      }

      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ message: error.message });
        return;
      }

      throw error;
    }
  },

  async getOne(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };

      const ingredient = await InventoryService.findOne(id, user);

      res.json(ingredient);
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ message: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ message: error.message });
        return;
      }

      throw error;
    }
  },

  async getBySku(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { sku } = req.params as { sku: string };

      const ingredient = await InventoryService.findBySku(sku, user);

      res.json(ingredient);
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ message: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ message: error.message });
        return;
      }

      throw error;
    }
  },

  async getMovements(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const query = inventoryMovementsSchema.parse(req.query);

      const result = await InventoryService.getMovements(query, user);

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: 'Parámetros inválidos',
          errors: error.flatten().fieldErrors,
        });
        return;
      }

      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ message: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ message: error.message });
        return;
      }

      throw error;
    }
  },

  async getLowStock(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;

      const ingredients = await InventoryService.getLowStock(user);

      res.json(ingredients);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ message: error.message });
        return;
      }

      throw error;
    }
  },

  async getSummary(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;

      const summary = await InventoryService.getSummary(user);

      res.json(summary);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ message: error.message });
        return;
      }

      throw error;
    }
  },

  async getTotalValue(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;

      const totalValue = await InventoryService.getTotalValue(user);

      res.json({ totalValue: totalValue.toFixed(2) });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ message: error.message });
        return;
      }

      throw error;
    }
  },

  async createExit(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const data = inventoryExitSchema.parse(req.body);

      const result = await InventoryService.createExit(data, user);

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: 'Datos inválidos',
          errors: error.flatten().fieldErrors,
        });
        return;
      }

      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ message: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ message: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({ message: error.message });
        return;
      }

      throw error;
    }
  },

  async create(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const data = ingredientCreateSchema.parse(req.body);

      const ingredient = await InventoryService.createIngredient(data, user);

      res.status(201).json({
        success: true,
        message: 'Ingrediente creado correctamente.',
        ingredient,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: 'Datos inválidos',
          errors: error.flatten().fieldErrors,
        });
        return;
      }

      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ message: error.message });
        return;
      }

      if (error instanceof DuplicateError) {
        sendDuplicateErrorResponse(res, error);
        return;
      }

      // Handle UNIQUE VIOLATION from Prisma (the new migration indices)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta?.target as string[] | undefined)?.[0];
        if (target === 'name' || target?.includes('name')) {
          res.status(409).json({
            error: 'DUPLICATE_ERROR',
            message: 'Ya existe un ingrediente con este nombre.',
            details: { field: target },
          });
          return;
        }
        if (target === 'sku' || target?.includes('sku')) {
          res.status(409).json({
            error: 'DUPLICATE_ERROR',
            message: 'Ya existe un ingrediente con este SKU.',
            details: { field: target },
          });
          return;
        }
      }

      throw error;
    }
  },

  async update(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };
      const data = ingredientUpdateSchema.parse(req.body);

      const ingredient = await InventoryService.updateIngredient(id, data, user);

      res.json({
        success: true,
        message: 'Ingrediente actualizado correctamente.',
        ingredient,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: 'Datos inválidos',
          errors: error.flatten().fieldErrors,
        });
        return;
      }

      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ message: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ message: error.message });
        return;
      }

      if (error instanceof DuplicateError) {
        sendDuplicateErrorResponse(res, error);
        return;
      }

      // Handle UNIQUE VIOLATION from Prisma
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta?.target as string[] | undefined)?.[0];
        if (target === 'name' || target?.includes('name')) {
          res.status(409).json({
            error: 'DUPLICATE_ERROR',
            message: 'Ya existe otro ingrediente con este nombre.',
            details: { field: target },
          });
          return;
        }
        if (target === 'sku' || target?.includes('sku')) {
          res.status(409).json({
            error: 'DUPLICATE_ERROR',
            message: 'Ya existe otro ingrediente con este SKU.',
            details: { field: target },
          });
          return;
        }
      }

      throw error;
    }
  },

  async setActive(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };
      const { isActive } = req.body as { isActive: boolean };

      if (typeof isActive !== 'boolean') {
        res.status(400).json({ message: 'El campo isActive debe ser un booleano.' });
        return;
      }

      const ingredient = await InventoryService.setIngredientActive(id, isActive, user);

      res.json({
        success: true,
        message: `Ingrediente ${isActive ? 'activado' : 'desactivado'} correctamente.`,
        ingredient,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ message: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ message: error.message });
        return;
      }

      throw error;
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };

      await InventoryService.deleteIngredient(id, user);

      res.json({
        success: true,
        message: 'Ingrediente eliminado correctamente.',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ message: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ message: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'ConflictError') {
        res.status(409).json({ error: 'CONFLICT_ERROR', message: error.message });
        return;
      }

      throw error;
    }
  },

  async getUnits(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;

      const units = await InventoryService.getUnits(user);

      res.json(units);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ message: error.message });
        return;
      }

      throw error;
    }
  },
};
