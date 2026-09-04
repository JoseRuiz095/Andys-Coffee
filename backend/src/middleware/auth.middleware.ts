import type { Request, Response, NextFunction } from "express";
import { verifyJwtToken } from "../services/auth.service";
import { prisma } from "../config/prisma";

function getTokenFromCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const cookie = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("token="));

  if (!cookie) {
    return undefined;
  }

  return decodeURIComponent(cookie.slice("token=".length));
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : undefined;
  const token = tokenFromHeader ?? getTokenFromCookie(req.headers.cookie);

  if (!token) {
    return res.status(401).json({ message: "Token de autenticación ausente." });
  }

  try {
    const payload = verifyJwtToken(token);
    const userId = typeof payload.sub === "string" ? payload.sub : null;

    if (!userId) {
      return res.status(401).json({ message: "Token inválido." });
    }

    // Lightweight DB check to ensure user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        isActive: true,
        role: {
          select: {
            name: true,
            permissions: {
              select: { permission: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Sesión inválida o usuario inactivo." });
    }

    const permissions = user.role?.permissions.map(({ permission }) => permission.name) ?? [];

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role?.name ?? "",
      isActive: user.isActive,
      permissions: permissions,
    };
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido o expirado." });
  }
}