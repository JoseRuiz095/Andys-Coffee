import type { Request, Response, NextFunction } from "express";
import { verifyJwtToken } from "../services/auth.service";
import { prisma } from "../config/prisma";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token de autenticación ausente." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyJwtToken(token);

    const userId = typeof payload.sub === "string" ? payload.sub : null;

    if (!userId) {
      return res.status(401).json({ message: "Token inválido." });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Sesión inválida o usuario inactivo." });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido o expirado." });
  }
}