import NextAuth from "next-auth";
import { authConfig } from "./authConfig";

export const { auth } = NextAuth(authConfig);
