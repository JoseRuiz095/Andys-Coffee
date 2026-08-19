import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { MenuService } from '../services/menu.service';

export const MenuController = {
  getMenu: asyncHandler(async (req: Request, res: Response) => {
    const menu = await MenuService.getFullMenu();
    res.status(200).json(menu);
  }),
};