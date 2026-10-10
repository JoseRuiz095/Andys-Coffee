import { Request, Response } from 'express';
import { z } from 'zod';
import { PurchaseService } from '../services/purchase.service';
import { createPurchaseSchema, purchaseListSchema } from '../validators/purchase.validator';
import { AuthUser } from '../services/auth.service';

// Bodies arrive already validated by validate() in purchase.routes.ts; domain errors
// (including the DUPLICATE_ERROR shape the frontend reads) are mapped by the global errorHandler.
export const PurchaseController = {
  async getAll(req: Request, res: Response) {
    const { status, page, limit } = purchaseListSchema.parse(req.query);
    res.json(await PurchaseService.findAll(req.user as AuthUser, status, page, limit));
  },

  async getOne(req: Request, res: Response) {
    res.json(await PurchaseService.findOne(req.params.id as string, req.user as AuthUser));
  },

  async create(req: Request, res: Response) {
    const data = req.body as z.infer<typeof createPurchaseSchema>;
    const idempotencyKey = req.header('X-Idempotency-Key');
    if (!idempotencyKey || idempotencyKey.length > 100) {
      return res.status(400).json({ message: 'X-Idempotency-Key es requerido y debe tener como máximo 100 caracteres.' });
    }
    const purchase = await PurchaseService.create(data, req.user as AuthUser, idempotencyKey);
    res.status(201).json({ success: true, message: 'Compra creada correctamente.', purchase });
  },

  async receivePurchase(req: Request, res: Response) {
    const purchase = await PurchaseService.receivePurchase(req.params.id as string, req.user as AuthUser);
    res.json({ success: true, message: 'Compra recibida correctamente.', purchase });
  },

  async delete(req: Request, res: Response) {
    await PurchaseService.deletePurchase(req.params.id as string, req.user as AuthUser);
    res.json({ success: true, message: 'Compra eliminada correctamente.' });
  },
};
