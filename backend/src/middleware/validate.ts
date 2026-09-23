import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

/**
 * Validates and replaces req.body with the parsed value. Uses parseAsync so schemas with
 * async refinements also work (a sync parse() throws "Encountered Promise during synchronous
 * parse" for those — that made every POST /api/expenses fail with 500, see N-03).
 */
export const validate = <T>(schema: z.ZodSchema<T>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = await schema.parseAsync(req.body);
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
