import type { ReactNode } from "react";
import type { AuthUser } from "../../features/auth/types/auth.types";
import { hasPermission } from "../../features/auth/utils/permissions";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
  requiredPermissions?: string[];
  requireAll?: boolean;
  fallback?: ReactNode;
  currentUser: AuthUser | null;
}

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredPermissions = [],
  requireAll = false,
  fallback = null,
  currentUser,
}: ProtectedRouteProps) {
  if (!currentUser) {
    return fallback;
  }

  const permissionsToCheck = requiredPermission
    ? [requiredPermission, ...requiredPermissions]
    : requiredPermissions;

  if (permissionsToCheck.length === 0) {
    // No permission requirement, render children
    return children;
  }

  const userHasAccess = requireAll
    ? permissionsToCheck.every((perm) => hasPermission(currentUser, perm))
    : permissionsToCheck.some((perm) => hasPermission(currentUser, perm));

  if (!userHasAccess) {
    return fallback;
  }

  return children;
}

/**
 * Hook para verificar múltiples permisos
 */
export function usePermissions(user: AuthUser | null) {
  return {
    can: (permission: string) => hasPermission(user, permission),
    canAny: (permissions: string[]) =>
      permissions.some((p) => hasPermission(user, p)),
    canAll: (permissions: string[]) =>
      permissions.every((p) => hasPermission(user, p)),
  };
}
