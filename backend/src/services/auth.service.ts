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
  roleName?: string;
  isActive: boolean;
  permissions?: string[];
};

type UserWithRole = User & {
  role?: {
    name: string | null;
  } | null;
};

export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: { select: { name: true } } },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  // Fetch permissions associated with the user's role to include in the response
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: user.roleId },
    select: { permission: { select: { name: true } } },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role?.name ?? undefined,
    isActive: user.isActive,
    permissions: rolePermissions.map((rp) => rp.permission.name),
  };
}

export function createJwtToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.roleName ?? undefined,
      permissions: user.permissions,
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