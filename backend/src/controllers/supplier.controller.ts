import { Request, Response } from 'express';
import { SupplierService } from '../services/supplier.service';
import { AuthUser } from '../services/auth.service';

export const SupplierController = {
  async getAll(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { page = '1', limit = '20' } = req.query;

      const result = await SupplierService.findAll(
        user,
        parseInt(page as string),
        parseInt(limit as string),
      );

      res.json(result);
    } catch (error) {
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
      const { name, phone, email, address } = req.body as {
        name?: string;
        phone?: string;
        email?: string;
        address?: string;
      };

      if (!name) {
        res.status(400).json({ error: 'El nombre del proveedor es requerido.' });
        return;
      }

      const supplier = await SupplierService.create({ name, phone, email, address }, user);

      res.status(201).json({
        success: true,
        message: 'Proveedor creado correctamente.',
        supplier,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({ error: error.message });
        return;
      }

      throw error;
    }
  },
};
