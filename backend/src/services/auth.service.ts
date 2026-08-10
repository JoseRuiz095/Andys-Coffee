import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";
import { JWT_SECRET } from "../config/security";
import type { User } from "@prisma/client";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  isActive: boolean;
};

function sanitizeUser(user: User): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    isActive: user.isActive,
  };
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  return sanitizeUser(user);
}

export function createJwtToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
    },
    JWT_SECRET,
    {
      expiresIn: "8h",
    }
  );
}

export function verifyJwtToken(token: string): jwt.JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET);

  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }

  return decoded;
}