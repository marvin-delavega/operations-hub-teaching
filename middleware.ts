import { auth } from "@/shared/infrastructure/authEdge";
import { NextResponse } from "next/server";
import { requiredPermissionForPath, permissionsSatisfy } from "@/shared/domain/Permissions";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  // Machine-auth endpoint for the nightly rollup refresh (shared-secret token, no session).
  "/replenishment/api/rollup/refresh",
  // First-run / recovery DB connection setup — the DB backing auth may not exist yet.
  // Self-locks in its own route handlers once the connection is configured and reachable.
  "/connect",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const need = requiredPermissionForPath(pathname);
  if (need) {
    // Old tokens (pre-RBAC) carry no permissions — treat as empty so they never bypass a gate.
    const perms = req.auth.user.permissions ?? [];
    if (!permissionsSatisfy(perms, need)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
