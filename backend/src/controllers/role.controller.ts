import { Request, Response } from 'express';
import { z } from 'zod';
import { RoleService } from '../services/role.service';
import { roleCreateSchema, roleUpdateSchema, assignPermissionsSchema } from '../validators/role.validator';
import { AuthUser } from '../services/auth.service';
import { DuplicateError } from '../utils/errors';
import { sendDuplicateErrorResponse } from '../utils/controllerErrors';

export const RoleController = {
  async getAll(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;

      const result = await RoleService.findAll(user);

      res.json(result);
    } catch (error) {
      throw error;
    }
  },

  async getOne(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };

      const role = await RoleService.findById(id, user);

      res.json(role);
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ message: error.message });
        return;
      }

      throw error;
    }
  },

  async create(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const data = roleCreateSchema.parse(req.body);

      const newRole = await RoleService.create(data, user);

      res.status(201).json({
        success: true,
        message: 'Rol creado correctamente.',
        role: newRole,
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

      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({ message: error.message });
        return;
      }

      throw error;
    }
  },

  async update(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };
      const data = roleUpdateSchema.parse(req.body);

      const updatedRole = await RoleService.update(id, data, user);

      res.json({
        success: true,
        message: 'Rol actualizado correctamente.',
        role: updatedRole,
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

      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({ message: error.message });
        return;
      }

      throw error;
    }
  },

  async assignPermissions(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };
      const { permissionIds } = assignPermissionsSchema.parse(req.body);

      const updatedRole = await RoleService.assignPermissions(id, permissionIds, user);

      res.json({
        success: true,
        message: 'Permisos asignados correctamente.',
        role: updatedRole,
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

      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({ message: error.message });
        return;
      }

      throw error;
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };

      await RoleService.deleteRole(id, user);

      res.json({
        success: true,
        message: 'Rol eliminado correctamente.',
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

      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({ message: error.message });
        return;
      }

      throw error;
    }
  },
};

export const PermissionController = {
  async list(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;

      const permissions = await RoleService.listPermissions(user);

      res.json(permissions);
    } catch (error) {
      throw error;
    }
  },
};
