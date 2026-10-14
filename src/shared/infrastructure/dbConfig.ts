// File-backed store + resolver for the ActiveOne MySQL connection. The connection can't
// live in the DB it configures, so it is persisted to a gitignored JSON file on disk.
// DB_* env vars remain as a seed/fallback only (used when no file config exists yet).
import fs from "fs";
import path from "path";
import type { DbConnectionConfig } from "../domain/DbConnectionConfig";

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "db-config.json");

export function configPath(): string {
  return CONFIG_FILE;
}

/** Reads the saved connection file, or null if absent/unparseable/incomplete. */
export function readFileConfig(): DbConnectionConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<DbConnectionConfig>;
    if (
      typeof parsed.host === "string" &&
      typeof parsed.user === "string" &&
      typeof parsed.password === "string" &&
      typeof parsed.database === "string" &&
      typeof parsed.port === "number"
    ) {
      return {
        host: parsed.host,
        port: parsed.port,
        user: parsed.user,
        password: parsed.password,
        database: parsed.database,
        ...(typeof parsed.appDatabase === "string" && parsed.appDatabase ? { appDatabase: parsed.appDatabase } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Persists the connection to disk (creates the data dir if needed). */
export function writeFileConfig(cfg: DbConnectionConfig): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
}

/** Assembles a config from DB_* env vars, or null if the essentials are missing. */
function envConfig(): DbConnectionConfig | null {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_APP_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) return null;
  return {
    host: DB_HOST,
    port: Number(DB_PORT ?? 3306),
    user: DB_USER,
    password: DB_PASSWORD ?? "",
    database: DB_NAME,
    ...(DB_APP_NAME ? { appDatabase: DB_APP_NAME } : {}),
  };
}

/** File config wins; env is the seed/fallback for first boot and the CLI backfill script. */
export function resolveDbConfig(): DbConnectionConfig | null {
  return readFileConfig() ?? envConfig();
}

/** Cheap fs/env check with no DB round-trip — safe to call in server layouts. */
export function isDbConfigured(): boolean {
  return resolveDbConfig() !== null;
}
