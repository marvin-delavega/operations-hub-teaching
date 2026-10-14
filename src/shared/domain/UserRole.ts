// NextAuth module augmentation: the session/JWT carry the user's effective RBAC permissions
// (union of active roles, resolved at sign-in) plus their assigned role names for display.

declare module "next-auth" {
  interface User {
    permissions: string[];
    roleNames: string[];
    rememberMe?: boolean;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      permissions: string[];
      roleNames: string[];
      rememberMe?: boolean;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    permissions: string[];
    roleNames: string[];
    rememberMe?: boolean;
  }
}
