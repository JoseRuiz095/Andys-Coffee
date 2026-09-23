import { Request, Response } from 'express';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import { userListSchema, userCreateSchema, userUpdateSchema } from '../validators/user.validator';
import { AuthUser } from '../services/auth.service';

// Bodies arrive already validated by validate() in user.routes.ts; domain errors
// are mapped by the global errorHandler.
export const UserController = {
  async getAll(req: Request, res: Response) {
    const query = userListSchema.parse(req.query);
    res.json(await UserService.findAll(req.user as AuthUser, query.page, query.limit, query.isActive, query.search, query.roleId));
  },

  async getOne(req: Request, res: Response) {
    res.json(await UserService.findById(req.params.id as string, req.user as AuthUser));
  },

  async create(req: Request, res: Response) {
    const data = req.body as z.infer<typeof userCreateSchema>;
    const user = await UserService.create(data, req.user as AuthUser);
    res.status(201).json({ success: true, message: 'Usuario creado correctamente.', user });
  },

  async update(req: Request, res: Response) {
    const data = req.body as z.infer<typeof userUpdateSchema>;
    const user = await UserService.update(req.params.id as string, data, req.user as AuthUser);
    res.json({ success: true, message: 'Usuario actualizado correctamente.', user });
  },

  async setActive(req: Request, res: Response) {
    const { isActive } = req.body as { isActive: boolean };
    const user = await UserService.setActive(req.params.id as string, isActive, req.user as AuthUser);
    res.json({
      success: true,
      message: `Usuario ${isActive ? 'activado' : 'desactivado'} correctamente.`,
      user,
    });
  },

  async delete(req: Request, res: Response) {
    await UserService.deleteUser(req.params.id as string, req.user as AuthUser);
    res.json({ success: true, message: 'Usuario eliminado correctamente.' });
  },
};
