import type { NextAuthConfig } from "next-auth";
import "@/shared/domain/UserRole";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user, trigger }) {
      if (trigger === "signIn" && user) {
        const u = user as { permissions?: string[]; roleNames?: string[]; rememberMe?: boolean };
        token.permissions = u.permissions ?? [];
        token.roleNames = u.roleNames ?? [];
        token.rememberMe = u.rememberMe ?? true;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub as string;
      session.user.permissions = token.permissions ?? [];
      session.user.roleNames = token.roleNames ?? [];
      session.user.rememberMe = token.rememberMe;
      return session;
    },
  },
  providers: [],
};
