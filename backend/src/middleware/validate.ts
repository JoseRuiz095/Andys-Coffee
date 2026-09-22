import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const validate = <T>(schema: z.ZodSchema<T>) => (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      // Same shape as the global errorHandler's ZodError branch.
      return res.status(400).json({
        message: 'Error de validación.',
        errors: error.flatten().fieldErrors,
      });
    }
    next(error);
  }
};
