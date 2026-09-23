import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserRepository } from "../repositories/user.repository";
import { JWT_SECRET } from "../config/security";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName?: string;
  isActive: boolean;
  permissions?: string[];
};

// bcrypt hash (12 rounds) of a random string; only used to equalize login timing.
const TIMING_SAFE_DUMMY_HASH = bcrypt.hashSync(`timing-${Date.now()}-${Math.random()}`, 12);

/** Result of a successful login: the public user plus the session version to sign into the JWT. */
export type AuthenticatedUser = AuthUser & { tokenVersion: number };

export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthenticatedUser | null> {
  const user = await UserRepository.findForLogin(email);

  // Always run bcrypt, even for unknown/inactive users, so response time doesn't
  // reveal which emails exist.
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? TIMING_SAFE_DUMMY_HASH);

  if (!user || !user.isActive) {
    return null;
  }

  if (!passwordMatches) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role?.name ?? undefined,
    isActive: user.isActive,
    permissions: user.role?.permissions.map(({ permission }) => permission.name) ?? [],
    tokenVersion: user.tokenVersion,
  };
}

/**
 * Signs a session token. `tokenVersion` must match User.tokenVersion for requireAuth to
 * accept it (claim `tv`); bumping the column revokes every token issued before.
 */
export function createJwtToken(user: AuthUser, tokenVersion = 0): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.roleName ?? undefined,
      permissions: user.permissions,
      tv: tokenVersion,
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