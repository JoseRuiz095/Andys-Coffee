import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const validate = <T>(schema: z.ZodSchema<T>) => (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.message,
      });
    }
    next(error);
  }
};
