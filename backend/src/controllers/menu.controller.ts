import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { filterQuerySchema } from '../validators/product.validator';
import { MenuService } from '../services/menu.service';

export const MenuController = {
  getMenuItems: asyncHandler(async (req: Request, res: Response) => {
    // Reutilizamos el esquema de validación de los productos
    const query = filterQuerySchema.parse(req.query);
    const menuItems = await MenuService.getMenuItems(query);
    res.status(200).json(menuItems);
  }),
};