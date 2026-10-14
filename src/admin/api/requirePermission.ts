import { auth } from "@/shared/infrastructure/auth";
import { permissionsSatisfy, type PermissionKey } from "@/shared/domain/Permissions";

/** Server-side permission gate for admin API routes. Returns true only when the logged-in
 *  user's effective permissions satisfy `need` ("ANY_ADMIN" = holds any admin-tab permission). */
export async function requirePermission(need: PermissionKey | "ANY_ADMIN"): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  return permissionsSatisfy(session.user.permissions ?? [], need);
}
