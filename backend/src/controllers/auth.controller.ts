import type { Request, Response } from "express";
import { authenticateUser, createJwtToken } from "../services/auth.service";

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Email y password son requeridos." });
  }

  const user = await authenticateUser(email, password);

  if (!user) {
    return res.status(401).json({ message: "Correo o contraseña incorrectos." });
  }

  const token = createJwtToken(user);

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 8 * 60 * 60 * 1000,
  });

  return res.json({ token, user });
}

export async function getCurrentUser(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "No autorizado." });
  }

  return res.json({ user: req.user });
}