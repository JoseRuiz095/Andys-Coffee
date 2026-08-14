import { Request, Response, NextFunction } from 'express';

// Definimos un tipo para los manejadores de ruta asíncronos de Express.
type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

/**
 * Un 'wrapper' de orden superior para manejar errores en rutas asíncronas de Express.
 * Captura cualquier error en una promesa y lo pasa a `next()`.
 */
export const asyncHandler = (fn: AsyncRequestHandler) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };