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

// bcrypt hash (12 rounds) of a random string; only used to equalize login timing.
const TIMING_SAFE_DUMMY_HASH = bcrypt.hashSync(`timing-${Date.now()}-${Math.random()}`, 12);

export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: { select: { name: true } } },
  });

  // Always run bcrypt, even for unknown/inactive users, so response time doesn't
  // reveal which emails exist.
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? TIMING_SAFE_DUMMY_HASH);

  if (!user || !user.isActive) {
    return null;
  }

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
      issuer: "Andys-Coffee-API",
      audience: "Andys-Coffee-Client",
    }
  );
}

export function verifyJwtToken(token: string): jwt.JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET, {
    issuer: "Andys-Coffee-API",
    audience: "Andys-Coffee-Client",
    algorithms: ["HS256"],
  });

  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }

  return decoded;
}