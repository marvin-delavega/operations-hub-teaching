import pool from "./db";
import { ALL_PERMISSION_KEYS, isPermissionKey } from "@/shared/domain/Permissions";

export interface ResolvedPermissions {
  permissions: string[];
  roleNames: string[];
}

// Resolves a user's effective permissions at sign-in: the union of permission keys across
// their ACTIVE roles. A protected (Administrator) role contributes the entire code catalog,
// so its permissions always track the catalog with no role_permission rows to keep in sync.
// Disabled roles contribute no permissions but their names still surface in roleNames.
export async function resolveUserPermissions(userId: number): Promise<ResolvedPermissions> {
  const [roleRows] = await pool.execute(
    `SELECT r.id, r.name, r.is_active AS isActive, r.is_protected AS isProtected
     FROM user_role ur
     JOIN role r ON r.id = ur.role_id
     WHERE ur.user_id = ?`,
    [userId],
  );
  const roles = roleRows as Array<{
    id: number;
    name: string;
    isActive: number;
    isProtected: number;
  }>;

  const roleNames = roles.map((r) => r.name);
  const activeRoles = roles.filter((r) => r.isActive === 1);

  const permissions = new Set<string>();
  let needsPermissionRows = false;
  for (const role of activeRoles) {
    if (role.isProtected === 1) {
      for (const key of ALL_PERMISSION_KEYS) permissions.add(key);
    } else {
      needsPermissionRows = true;
    }
  }

  if (needsPermissionRows) {
    const activeNonProtectedIds = activeRoles
      .filter((r) => r.isProtected !== 1)
      .map((r) => r.id);
    if (activeNonProtectedIds.length) {
      const placeholders = activeNonProtectedIds.map(() => "?").join(", ");
      const [permRows] = await pool.execute(
        `SELECT permission_key AS permissionKey FROM role_permission WHERE role_id IN (${placeholders})`,
        activeNonProtectedIds,
      );
      for (const row of permRows as Array<{ permissionKey: string }>) {
        if (isPermissionKey(row.permissionKey)) permissions.add(row.permissionKey);
      }
    }
  }

  return {
    permissions: [...permissions].sort(),
    roleNames,
  };
}
