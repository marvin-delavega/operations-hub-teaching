import type { DbConnectionConfig, DbConnectionConfigInput } from "../domain/DbConnectionConfig";

/**
 * Turns raw client input into a full config. A blank/omitted password keeps the currently
 * stored one (so an edit needn't re-type the password); if none is stored it becomes "".
 */
export function coerceDbConfigInput(
  input: DbConnectionConfigInput,
  existing: DbConnectionConfig | null,
): DbConnectionConfig {
  const passwordProvided = typeof input.password === "string" && input.password.length > 0;
  const appDatabase = String(input.appDatabase ?? "").trim();
  return {
    host: String(input.host ?? "").trim(),
    port: Number(input.port ?? 3306),
    user: String(input.user ?? "").trim(),
    password: passwordProvided ? String(input.password) : existing?.password ?? "",
    database: String(input.database ?? "").trim(),
    ...(appDatabase ? { appDatabase } : {}),
  };
}
