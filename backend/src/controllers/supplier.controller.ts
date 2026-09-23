import { Request, Response } from 'express';
import { z } from 'zod';
import { SupplierService } from '../services/supplier.service';
import { supplierListSchema, supplierCreateSchema, supplierUpdateSchema } from '../validators/supplier.validator';
import { searchQuerySchema } from '../validators/common.validator';
import { AuthUser } from '../services/auth.service';

// Bodies arrive already validated by validate() in supplier.routes.ts; domain errors
// are mapped by the global errorHandler.
export const SupplierController = {
  async getAll(req: Request, res: Response) {
    const query = supplierListSchema.parse(req.query);
    res.json(await SupplierService.findAll(req.user as AuthUser, query.page, query.limit, query.isActive, query.search));
  },

  async getOne(req: Request, res: Response) {
    res.json(await SupplierService.findById(req.params.id as string, req.user as AuthUser));
  },

  async search(req: Request, res: Response) {
    const { q } = searchQuerySchema.parse(req.query);
    res.json(await SupplierService.search(q, req.user as AuthUser));
  },

  async create(req: Request, res: Response) {
    const data = req.body as z.infer<typeof supplierCreateSchema>;
    const supplier = await SupplierService.create(data, req.user as AuthUser);
    res.status(201).json({ success: true, message: 'Proveedor creado correctamente.', supplier });
  },

  async update(req: Request, res: Response) {
    const data = req.body as z.infer<typeof supplierUpdateSchema>;
    const supplier = await SupplierService.update(req.params.id as string, data, req.user as AuthUser);
    res.json({ success: true, message: 'Proveedor actualizado correctamente.', supplier });
  },

  async setActive(req: Request, res: Response) {
    const { isActive } = req.body as { isActive: boolean };
    const supplier = await SupplierService.setActive(req.params.id as string, isActive, req.user as AuthUser);
    res.json({
      success: true,
      message: `Proveedor ${isActive ? 'activado' : 'desactivado'} correctamente.`,
      supplier,
    });
  },

  async delete(req: Request, res: Response) {
    await SupplierService.deleteSupplier(req.params.id as string, req.user as AuthUser);
    res.json({ success: true, message: 'Proveedor eliminado correctamente.' });
  },
};
