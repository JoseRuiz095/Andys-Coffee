import { Request, Response } from 'express';
import { z } from 'zod';
import { PurchaseService } from '../services/purchase.service';
import { createPurchaseSchema } from '../validators/purchase.validator';
import { AuthUser } from '../services/auth.service';

export const PurchaseController = {
  async getAll(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { status, page = '1', limit = '20' } = req.query;

      const result = await PurchaseService.findAll(
        user,
        status as string | undefined,
        parseInt(page as string),
        parseInt(limit as string),
      );

      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ error: error.message });
        return;
      }

      throw error;
    }
  },

  async getOne(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };

      const purchase = await PurchaseService.findOne(id, user);

      res.json(purchase);
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ error: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ error: error.message });
        return;
      }

      throw error;
    }
  },

  async create(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const data = createPurchaseSchema.parse(req.body);

      const purchase = await PurchaseService.create(data, user);

      res.status(201).json({
        success: true,
        message: 'Compra creada correctamente.',
        purchase,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Datos inválidos',
          details: error.flatten().fieldErrors,
        });
        return;
      }

      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ error: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'DuplicateError') {
        const duplicateError = error as any;
        res.status(409).json({
          error: 'DUPLICATE_ERROR',
          message: error.message,
          details: {
            type: duplicateError.type,
            existingId: duplicateError.existingId,
          },
        });
        return;
      }

      // Handle UNIQUE VIOLATION from Prisma
      if ((error as any).code === 'P2002') {
        const target = (error as any).meta?.target?.[0];
        if (target === 'name' || target?.includes('name')) {
          res.status(409).json({
            error: 'DUPLICATE_ERROR',
            message: 'Ya existe un registro con este nombre.',
            details: { field: target },
          });
          return;
        }
      }

      throw error;
    }
  },

  async receivePurchase(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };

      const purchase = await PurchaseService.receivePurchase(id, user);

      res.json({
        success: true,
        message: 'Compra recibida correctamente.',
        purchase,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ error: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ error: error.message });
        return;
      }

      throw error;
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };

      await PurchaseService.deletePurchase(id, user);

      res.json({
        success: true,
        message: 'Compra eliminada correctamente.',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ error: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ error: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'ConflictError') {
        res.status(409).json({ error: 'CONFLICT_ERROR', message: error.message });
        return;
      }

      throw error;
    }
  },
};
