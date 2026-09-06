import type { Request, Response } from "express";
import { authenticateUser, createJwtToken } from "../services/auth.service";
import { auditLog } from "../utils/logger";

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Email y password son requeridos." });
  }

  const user = await authenticateUser(email, password);

  if (!user) {
    auditLog({ requestId: req.id, action: "LOGIN_FAILED", entity: "auth" }, "Authentication failed");
    return res.status(401).json({ message: "Correo o contraseña incorrectos." });
  }

  const token = createJwtToken(user);

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000,
  });

  auditLog({
    requestId: req.id,
    actor: { id: user.id, name: user.name, role: user.roleName },
    action: "LOGIN_SUCCEEDED",
    entity: "auth",
    entityId: user.id,
  }, "Authentication succeeded");

  return res.json({ user });
}

export function logout(req: Request, res: Response) {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  auditLog({ requestId: req.id, action: "LOGOUT", entity: "auth" }, "Session logout requested");

  return res.status(204).send();
}

export async function getCurrentUser(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "No autorizado." });
  }

  return res.json({ user: req.user });
}

export function getCsrfToken(req: Request, res: Response) {
  return res.json({ token: req.csrfToken() });
}