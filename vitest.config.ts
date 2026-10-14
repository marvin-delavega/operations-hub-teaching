import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit-test config. Tests live under tests/ (mirroring src/) and import source
// via the same `@/*` -> ./src/* alias the app uses. Pure-logic tests only: no
// database, no Next.js runtime, so the `node` environment is sufficient.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
});
