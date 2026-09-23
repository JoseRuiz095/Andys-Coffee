import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { logger } from '../utils/logger';
import { DuplicateError } from '../utils/errors';
import { sendDuplicateErrorResponse } from '../utils/controllerErrors';

// Errors reaching Express can be anything; these are the fields this handler inspects.
type HandledError = Error & { code?: string };

export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(error);
  }
  const err = (error ?? {}) as HandledError;

  logger.error({
    errorName: err?.name ?? 'UnknownError',
    requestId: req.id,
    method: req.method,
    path: req.path,
  }, 'Request failed');

  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Error de validación.',
      errors: err.flatten().fieldErrors,
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }

  if (err.name === 'UploadValidationError' || err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }

  if (err.name === 'AuthenticationError' || err.message === 'Authentication required.' || err.message === 'Autenticación requerida.') {
    return res.status(401).json({ message: 'Autenticación requerida.' });
  }

  if (err.name === 'AuthorizationError') {
    return res.status(403).json({ message: err.message });
  }

  if (err.name === 'NotFoundError') {
    return res.status(404).json({ message: err.message });
  }

  if (err.name === 'StateTransitionError' || err.name === 'BusinessRuleError' || err.name === 'ConflictError') {
    return res.status(409).json({ message: err.message });
  }

  if (err instanceof DuplicateError) {
    return sendDuplicateErrorResponse(res, err);
  }

  if (err.code === 'EBADCSRFTOKEN' || (typeof err.message === 'string' && err.message.startsWith('Did not get a valid CSRF token'))) {
    return res.status(403).json({ message: 'CSRF token is invalid.' });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'This origin is not allowed.' });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'El recurso ya existe.' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Recurso no encontrado.' });
    }
    if (err.code === 'P2003' || err.code === 'P2004' || err.code === 'P2014') {
      return res.status(409).json({ message: 'La operación entra en conflicto con datos existentes.' });
    }
    if (err.code === 'P2034') {
      return res.status(409).json({ message: 'La operación no pudo completarse por un conflicto de concurrencia. Intenta de nuevo.' });
    }
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON format in request body.' });
  }

  return res.status(500).json({ message: 'Ocurrió un error inesperado en el servidor.' });
};