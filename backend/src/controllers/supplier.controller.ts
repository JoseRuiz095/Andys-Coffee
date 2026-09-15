import { Request, Response } from 'express';
import { z } from 'zod';
import { SupplierService } from '../services/supplier.service';
import { supplierListSchema, supplierCreateSchema, supplierUpdateSchema } from '../validators/supplier.validator';
import { AuthUser } from '../services/auth.service';

export const SupplierController = {
  async getAll(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const query = supplierListSchema.parse(req.query);

      const result = await SupplierService.findAll(
        user,
        query.page,
        query.limit,
        query.isActive,
        query.search,
      );

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Datos inválidos',
          details: error.flatten().fieldErrors,
        });
        return;
      }

      throw error;
    }
  },

  async getOne(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };

      const supplier = await SupplierService.findById(id, user);

      res.json(supplier);
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ error: error.message });
        return;
      }

      throw error;
    }
  },

  async search(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { q } = req.query as { q?: string };

      if (!q) {
        res.status(400).json({ error: 'Parámetro de búsqueda requerido: q' });
        return;
      }

      const results = await SupplierService.search(q, user);

      res.json(results);
    } catch (error) {
      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({ error: error.message });
        return;
      }

      throw error;
    }
  },

  async create(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const data = supplierCreateSchema.parse(req.body);

      const supplier = await SupplierService.create(data, user);

      res.status(201).json({
        success: true,
        message: 'Proveedor creado correctamente.',
        supplier,
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

      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({ error: error.message });
        return;
      }

      throw error;
    }
  },

  async update(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };
      const data = supplierUpdateSchema.parse(req.body);

      const supplier = await SupplierService.update(id, data, user);

      res.json({
        success: true,
        message: 'Proveedor actualizado correctamente.',
        supplier,
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

      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ error: error.message });
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

      throw error;
    }
  },

  async setActive(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };
      const { isActive } = req.body as { isActive: boolean };

      if (typeof isActive !== 'boolean') {
        res.status(400).json({ error: 'El campo isActive debe ser un booleano.' });
        return;
      }

      const supplier = await SupplierService.setActive(id, isActive, user);

      res.json({
        success: true,
        message: `Proveedor ${isActive ? 'activado' : 'desactivado'} correctamente.`,
        supplier,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ error: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ error: error.message });
        return;
      }

      throw error;
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };

      await SupplierService.deleteSupplier(id, user);

      res.json({
        success: true,
        message: 'Proveedor eliminado correctamente.',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthorizationError') {
        res.status(403).json({ error: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ error: error.message });
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
