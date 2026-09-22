import type { Request, Response } from "express";
import { authenticateUser, createJwtToken, verifyJwtToken, type AuthUser } from "../services/auth.service";
import { getRequestToken } from "../middleware/auth.middleware";
import { UserRepository } from "../repositories/user.repository";
import { loginSchema } from "../validators/password.validator";
import { auditLog } from "../utils/logger";
import { isProduction } from "../config/app";
import { ZodError } from "zod";

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProduction,
};

function setSessionCookie(res: Response, user: AuthUser, tokenVersion: number) {
  res.cookie("token", createJwtToken(user, tokenVersion), {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 8 * 60 * 60 * 1000,
  });
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const authenticated = await authenticateUser(email, password);

    if (!authenticated) {
      auditLog({ requestId: req.id, action: "LOGIN_FAILED", entity: "auth" }, "Authentication failed");
      return res.status(401).json({ message: "Correo o contraseña incorrectos." });
    }

    const { tokenVersion, ...user } = authenticated;
    setSessionCookie(res, user, tokenVersion);

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

export async function logout(req: Request, res: Response) {
  // Revoke the session server-side too (M-06): otherwise a copied token would keep
  // working until it expires. Best effort — an invalid/expired token needs no revoking.
  const token = getRequestToken(req);
  if (token) {
    try {
      const userId = verifyJwtToken(token).sub;
      if (typeof userId === "string") {
        await UserRepository.incrementTokenVersion(userId);
      }
    } catch {
      // Token already invalid: nothing to revoke.
    }
  }

  res.clearCookie("token", SESSION_COOKIE_OPTIONS);

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

    const updated = await UserService.changeOwnPassword(user.id, data.currentPassword, data.newPassword);
    // Changing the password revoked every session; keep this device signed in with a
    // token for the new version.
    setSessionCookie(res, user, updated.tokenVersion);

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