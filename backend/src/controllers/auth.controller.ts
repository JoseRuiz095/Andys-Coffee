import type { Request, Response } from "express";
import { authenticateUser, createJwtToken, type AuthUser } from "../services/auth.service";
import { loginSchema } from "../validators/password.validator";
import { auditLog } from "../utils/logger";
import { isProduction } from "../config/app";
import { ZodError } from "zod";

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await authenticateUser(email, password);

    if (!user) {
      auditLog({ requestId: req.id, action: "LOGIN_FAILED", entity: "auth" }, "Authentication failed");
      return res.status(401).json({ message: "Correo o contraseña incorrectos." });
    }

    const token = createJwtToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
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
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Error de validación.",
        errors: error.flatten().fieldErrors,
      });
    }
    throw error;
  }
}

export function logout(req: Request, res: Response) {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
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

export async function changePassword(req: Request, res: Response) {
  try {
    const { UserService } = await import('../services/user.service');
    const { changePasswordSchema } = await import('../validators/password.validator');

    const user = req.user as AuthUser;
    const data = changePasswordSchema.parse(req.body);

    await UserService.changeOwnPassword(user.id, data.currentPassword, data.newPassword);

    return res.json({
      success: true,
      message: 'Contraseña actualizada correctamente.',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({
        message: 'Error de validación.',
        errors: (error as ZodError).flatten().fieldErrors,
      });
      return;
    }

    throw error;
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const { UserService } = await import('../services/user.service');
    const { updateProfileSchema } = await import('../validators/password.validator');

    const user = req.user as AuthUser;
    const data = updateProfileSchema.parse(req.body);

    const updatedUser = await UserService.updateOwnProfile(user.id, data);

    return res.json({
      success: true,
      message: 'Perfil actualizado correctamente.',
      user: updatedUser,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({
        message: 'Error de validación.',
        errors: (error as ZodError).flatten().fieldErrors,
      });
      return;
    }

    throw error;
  }
}