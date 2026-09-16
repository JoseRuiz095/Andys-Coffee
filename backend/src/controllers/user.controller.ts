import { Request, Response } from 'express';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import { userListSchema, userCreateSchema, userUpdateSchema, setActiveSchema } from '../validators/user.validator';
import { AuthUser } from '../services/auth.service';

export const UserController = {
  async getAll(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const query = userListSchema.parse(req.query);

      const result = await UserService.findAll(
        user,
        query.page,
        query.limit,
        query.isActive,
        query.search,
        query.roleId,
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

      const foundUser = await UserService.findById(id, user);

      res.json(foundUser);
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFoundError') {
        res.status(404).json({ error: error.message });
        return;
      }

      throw error;
    }
  },

  async create(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const data = userCreateSchema.parse(req.body);

      const newUser = await UserService.create(data, user);

      res.status(201).json({
        success: true,
        message: 'Usuario creado correctamente.',
        user: newUser,
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
      const data = userUpdateSchema.parse(req.body);

      const updatedUser = await UserService.update(id, data, user);

      res.json({
        success: true,
        message: 'Usuario actualizado correctamente.',
        user: updatedUser,
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

      if (error instanceof Error && error.name === 'ConflictError') {
        res.status(409).json({ error: 'CONFLICT_ERROR', message: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({ error: error.message });
        return;
      }

      throw error;
    }
  },

  async setActive(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };
      const { isActive } = setActiveSchema.parse(req.body);

      const updatedUser = await UserService.setActive(id, isActive, user);

      res.json({
        success: true,
        message: `Usuario ${isActive ? 'activado' : 'desactivado'} correctamente.`,
        user: updatedUser,
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

      if (error instanceof Error && error.name === 'ConflictError') {
        res.status(409).json({ error: 'CONFLICT_ERROR', message: error.message });
        return;
      }

      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({ error: error.message });
        return;
      }

      throw error;
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const user = req.user as AuthUser;
      const { id } = req.params as { id: string };

      await UserService.deleteUser(id, user);

      res.json({
        success: true,
        message: 'Usuario eliminado correctamente.',
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

      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({ error: error.message });
        return;
      }

      throw error;
    }
  },
};
