import { resolveDbConfig } from "@/shared/infrastructure/dbConfig";
import { testConnection } from "@/shared/infrastructure/db";

/**
 * The public bootstrap surface (/connect) must self-lock once the app is usable, otherwise
 * anyone could re-point a running instance's database. It is allowed ONLY while the DB is
 * unconfigured or the configured connection is unreachable — once the live DB works, edits
 * must go through the authenticated admin Database tab instead.
 */
export async function bootstrapAllowed(): Promise<boolean> {
  const config = resolveDbConfig();
  if (!config) return true;
  const result = await testConnection(config);
  return !result.ok;
}
