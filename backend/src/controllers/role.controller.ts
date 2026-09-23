import { Request, Response } from 'express';
import { z } from 'zod';
import { RoleService } from '../services/role.service';
import { roleCreateSchema, roleUpdateSchema, assignPermissionsSchema } from '../validators/role.validator';
import { AuthUser } from '../services/auth.service';

// Bodies arrive already validated by validate() in role.routes.ts; domain errors
// are mapped by the global errorHandler.
export const RoleController = {
  async getAll(req: Request, res: Response) {
    res.json(await RoleService.findAll(req.user as AuthUser));
  },

  async getOne(req: Request, res: Response) {
    res.json(await RoleService.findById(req.params.id as string, req.user as AuthUser));
  },

  async create(req: Request, res: Response) {
    const data = req.body as z.infer<typeof roleCreateSchema>;
    const role = await RoleService.create(data, req.user as AuthUser);
    res.status(201).json({ success: true, message: 'Rol creado correctamente.', role });
  },

  async update(req: Request, res: Response) {
    const data = req.body as z.infer<typeof roleUpdateSchema>;
    const role = await RoleService.update(req.params.id as string, data, req.user as AuthUser);
    res.json({ success: true, message: 'Rol actualizado correctamente.', role });
  },

  async assignPermissions(req: Request, res: Response) {
    const { permissionIds } = req.body as z.infer<typeof assignPermissionsSchema>;
    const role = await RoleService.assignPermissions(req.params.id as string, permissionIds, req.user as AuthUser);
    res.json({ success: true, message: 'Permisos asignados correctamente.', role });
  },

  async delete(req: Request, res: Response) {
    await RoleService.deleteRole(req.params.id as string, req.user as AuthUser);
    res.json({ success: true, message: 'Rol eliminado correctamente.' });
  },
};

export const PermissionController = {
  async list(req: Request, res: Response) {
    res.json(await RoleService.listPermissions(req.user as AuthUser));
  },
};
