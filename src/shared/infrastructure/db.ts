import mysql, { type Pool } from "mysql2/promise";
import type { DbConnectionConfig } from "../domain/DbConnectionConfig";
import { resolveDbConfig, writeFileConfig } from "./dbConfig";

// The connection is configurable from the UI (first-run /connect page + admin Database
// tab). To apply a new connection without a restart, each pool is swappable at runtime:
// `activePool` is rebuilt on reconfigure, and the default export is a Proxy that always
// forwards to the current pool — so every `import pool` call site targets the live pool
// with no changes.
//
// Two pools share one config: the app pool (default export) targets the app-owned schema
// (`appDatabase`, falling back to `database`), and the ActiveOne pool targets the ERP
// schema (`database`). Both live on the same MySQL server, so a single connection can
// still JOIN across the two schemas with qualified names and commit cross-schema writes
// atomically.

function buildPool(cfg: DbConnectionConfig | null, database: string | undefined): Pool {
  // A null config yields a pool that errors on first use — same as today with missing env.
  return mysql.createPool({
    host: cfg?.host ?? "localhost",
    port: cfg?.port ?? 3306,
    user: cfg?.user,
    password: cfg?.password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

function appDatabaseName(cfg: DbConnectionConfig | null): string | undefined {
  return cfg?.appDatabase ?? cfg?.database;
}

function resolveConfig(): DbConnectionConfig | null {
  return resolveDbConfig();
}

let activePool: Pool = buildPool(resolveConfig(), appDatabaseName(resolveConfig()));
let activeOneActivePool: Pool = buildPool(resolveConfig(), resolveConfig()?.database);

/** Persists the new config and hot-swaps both live pools. Old pools drain in background. */
export async function reconfigurePool(cfg: DbConnectionConfig): Promise<void> {
  writeFileConfig(cfg);
  const previousApp = activePool;
  const previousActiveOne = activeOneActivePool;
  activePool = buildPool(cfg, appDatabaseName(cfg));
  activeOneActivePool = buildPool(cfg, cfg.database);
  previousApp.end().catch(() => {});
  previousActiveOne.end().catch(() => {});
}

export interface ConnectionTestResult {
  ok: boolean;
  error?: string;
}

/** Verifies a config with throwaway pools (SELECT 1 per schema). Never touches the live pool. */
export async function testConnection(cfg: DbConnectionConfig): Promise<ConnectionTestResult> {
  const appDb = appDatabaseName(cfg);
  const targets = appDb && appDb !== cfg.database ? [cfg.database, appDb] : [cfg.database];
  for (const schema of targets) {
    const probe = buildPool(cfg, schema);
    try {
      await probe.query("SELECT 1");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Connection failed.";
      const error = targets.length > 1 ? `Cannot reach schema \`${schema}\`: ${message}` : message;
      return { ok: false, error };
    } finally {
      probe.end().catch(() => {});
    }
  }
  return { ok: true };
}

// Forward every access to the current pool so `pool.execute(...)` always hits the live one.
function makeProxy(getPool: () => Pool): Pool {
  return new Proxy({} as Pool, {
    get(_target, prop, receiver) {
      const value = Reflect.get(getPool(), prop, receiver);
      return typeof value === "function" ? value.bind(getPool()) : value;
    },
  });
}

const pool = makeProxy(() => activePool);
const activeonePool = makeProxy(() => activeOneActivePool);

/** Backtick-quoted ActiveOne schema name for cross-schema qualification in mixed SQL. */
export function activeoneSchemaName(): string {
  const cfg = resolveConfig();
  const name = cfg?.database ?? "";
  if (name.includes("`")) throw new Error("ActiveOne database name must not contain backticks.");
  return `\`${name}\``;
}

/** Backtick-quoted app schema name (the default export pool's schema). */
export function appSchemaName(): string {
  const cfg = resolveConfig();
  const name = appDatabaseName(cfg) ?? "";
  if (name.includes("`")) throw new Error("App database name must not contain backticks.");
  return `\`${name}\``;
}

export default pool;
export { activeonePool };
