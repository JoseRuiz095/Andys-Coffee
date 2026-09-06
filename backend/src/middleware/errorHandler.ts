import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err); // Es crucial loguear el error real

  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Error de validación.',
      errors: err.flatten().fieldErrors,
    });
  }

  if (err.name === 'BusinessRuleError') {
    return res.status(409).json({ message: err.message });
  }

  // Error genérico para no exponer detalles de implementación
  return res.status(500).json({ message: 'Ocurrió un error inesperado en el servidor.' });
};