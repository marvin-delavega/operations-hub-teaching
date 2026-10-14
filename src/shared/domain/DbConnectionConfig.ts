// ActiveOne MySQL connection settings. `database` is the ActiveOne schema; `appDatabase`
// (optional) is the app-owned `ops_hub` schema on the same server. When `appDatabase` is
// unset the app schema is `database` (co-located fallback). Configured outside the app's
// auth/DB-backed gates (first-run bootstrap page + admin Database tab). Edge-safe: no imports.

export interface DbConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  appDatabase?: string;
}

/** Fields a client may submit. Password is optional so an edit can keep the stored one. */
export interface DbConnectionConfigInput {
  host?: unknown;
  port?: unknown;
  user?: unknown;
  password?: unknown;
  database?: unknown;
  appDatabase?: unknown;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/** Pure structural validation — does not attempt a connection. */
export function validateDbConnectionConfig(cfg: DbConnectionConfig): ValidationResult {
  if (!cfg.host.trim()) return { ok: false, error: "Host is required." };
  if (!cfg.user.trim()) return { ok: false, error: "User is required." };
  if (!cfg.database.trim()) return { ok: false, error: "Database name is required." };
  if (!Number.isInteger(cfg.port) || cfg.port < 1 || cfg.port > 65535) {
    return { ok: false, error: "Port must be an integer between 1 and 65535." };
  }
  return { ok: true };
}
