import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import pool from "./db";
import { authConfig } from "./authConfig";
import { resolveUserPermissions } from "./resolveUserPermissions";
import { ALL_PERMISSION_KEYS } from "@/shared/domain/Permissions";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember me" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const username = String(credentials.username);
        const password = String(credentials.password);
        const rememberMe = credentials.rememberMe !== "false";

        if (process.env.NODE_ENV === "development" && username === "dev" && password === "dev") {
          return {
            id: "0",
            name: "Dev User",
            permissions: [...ALL_PERMISSION_KEYS],
            roleNames: ["Administrator"],
            rememberMe,
          };
        }

        const [rows] = await pool.execute(
          "SELECT id, name, username, password_hash FROM users WHERE username = ? AND is_active = 1 LIMIT 1",
          [username]
        );

        const users = rows as Array<{
          id: number;
          name: string;
          username: string;
          password_hash: string;
        }>;

        if (!users.length) return null;

        const user = users[0];
        const valid = await bcrypt.compare(password, user.password_hash);

        if (!valid) return null;

        const { permissions, roleNames } = await resolveUserPermissions(user.id);

        return { id: String(user.id), name: user.name, permissions, roleNames, rememberMe };
      },
    }),
  ],
});
