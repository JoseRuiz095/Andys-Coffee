import { Request, Response, NextFunction } from 'express';

/**
 * Middleware factory para verificar permisos de usuario desde el token JWT.
 * @param requiredPermission El permiso necesario para acceder a la ruta.
 */
export const checkPermission = (requiredPermission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user?.permissions) {
      return res.status(401).json({ message: 'No autenticado o token inválido.' });
    }

    // La validación ahora es una simple comprobación de array, mucho más rápida.
    const hasPermission = user.permissions.includes(requiredPermission);

    if (!hasPermission) {
      return res.status(403).json({ message: 'No tienes permiso para realizar esta acción.' });
    }

    next();
  };
};