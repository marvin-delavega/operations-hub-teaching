/**
 * One-shot deploy backfill: consolidates 13 months of off-take into item_sales_daily
 * for all locations, then runs a parity check against the live sold CTE.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/backfill-sales-rollup.ts
 *
 * Safe to re-run — all writes are idempotent (ON DUPLICATE KEY UPDATE).
 * Chunked by month × location to avoid long locks on the live ERP database.
 */

import mysql from "mysql2/promise";
import { resolveDbConfig } from "../src/shared/infrastructure/dbConfig";

const MONTHS_BACK = 13;

// ─── DB connection ─────────────────────────────────────────────────────────

// Same source as the app: the UI-saved data/db-config.json, else DB_* env vars.
const dbConfig = resolveDbConfig();
if (!dbConfig) {
  throw new Error("No database configuration found (data/db-config.json or DB_* env vars).");
}

const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: 3,
});

// item_sales_daily lives in the app schema (defaults to the ActiveOne schema when unset).
const appDb = dbConfig.appDatabase ?? dbConfig.database;
const appSchema = appDb.includes("`") ? appDb : `\`${appDb}\``;
const ao = dbConfig.database.includes("`") ? dbConfig.database : `\`${dbConfig.database}\``;

// ─── SQL ───────────────────────────────────────────────────────────────────

const AGGREGATE_SQL = `
SELECT s.item_id, s.sale_date, SUM(s.qty_base) AS units_sold
FROM (
  SELECT ii.ITEM_ID AS item_id,
         ii.QUANTITY * COALESCE(ii.UNIT_BASE_QUANTITY, 1) AS qty_base,
         i.DATE AS sale_date
  FROM ${ao}.invoice_items ii
  JOIN ${ao}.invoice i ON i.ID = ii.INVOICE_ID
  WHERE i.LOCATION_ID = ? AND i.DATE BETWEEN ? AND ?
    AND i.STATUS NOT IN (0, 6, 7)
  UNION ALL
  SELECT sri.ITEM_ID,
         sri.QUANTITY * COALESCE(sri.UNIT_BASE_QUANTITY, 1),
         sr.DATE
  FROM ${ao}.sales_receipt_items sri
  JOIN ${ao}.sales_receipt sr ON sr.ID = sri.SALES_RECEIPT_ID
  WHERE sr.LOCATION_ID = ? AND sr.DATE BETWEEN ? AND ?
    AND sr.STATUS NOT IN (0, 6, 7)
    AND COALESCE(sr.RETURN_TRX, 0) = 0 AND sr.VOID_REFERENCE_NO IS NULL
) s
GROUP BY s.item_id, s.sale_date
HAVING SUM(s.qty_base) > 0
`;

/** Live sold CTE — used for parity check only. */
const PARITY_LIVE_SQL = `
SELECT SUM(s.qty_base) AS total_sold
FROM (
  SELECT ii.ITEM_ID AS item_id,
         ii.QUANTITY * COALESCE(ii.UNIT_BASE_QUANTITY, 1) AS qty_base
  FROM ${ao}.invoice_items ii
  JOIN ${ao}.invoice i ON i.ID = ii.INVOICE_ID
  WHERE i.LOCATION_ID = ? AND i.DATE BETWEEN ? AND ?
    AND i.STATUS NOT IN (0, 6, 7)
  UNION ALL
  SELECT sri.ITEM_ID,
         sri.QUANTITY * COALESCE(sri.UNIT_BASE_QUANTITY, 1)
  FROM ${ao}.sales_receipt_items sri
  JOIN ${ao}.sales_receipt sr ON sr.ID = sri.SALES_RECEIPT_ID
  WHERE sr.LOCATION_ID = ? AND sr.DATE BETWEEN ? AND ?
    AND sr.STATUS NOT IN (0, 6, 7)
    AND COALESCE(sr.RETURN_TRX, 0) = 0 AND sr.VOID_REFERENCE_NO IS NULL
) s
`;

const PARITY_ROLLUP_SQL = `
SELECT COALESCE(SUM(units_sold), 0) AS total_sold
FROM ${appSchema}.item_sales_daily
WHERE location_id = ? AND sale_date BETWEEN ? AND ?
`;

// ─── Date helpers ──────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function todayUtcStr(): string {
  return toDateStr(new Date());
}

function monthStart(monthsBack: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - monthsBack);
  return toDateStr(d);
}

function monthEnd(monthStartStr: string): string {
  const d = new Date(monthStartStr + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return toDateStr(d);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const today = todayUtcStr();
  console.log(`\n=== Sales Rollup Backfill — ${today} ===\n`);

  // All active location IDs
  const [locationRows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT ID AS id FROM ${ao}.location WHERE INACTIVE = 0`,
  );
  const locationIds = locationRows.map((r) => r.id as number);
  console.log(`Locations: ${locationIds.join(", ")} (${locationIds.length} total)\n`);

  let grandTotal = 0;
  const startMs = Date.now();

  for (let m = MONTHS_BACK; m >= 0; m--) {
    const from = monthStart(m);
    const rawEnd = monthEnd(from);
    const to = rawEnd > today ? today : rawEnd;
    process.stdout.write(`Month ${from} → ${to}: `);

    let monthRows = 0;
    for (const locationId of locationIds) {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        AGGREGATE_SQL,
        [locationId, from, to, locationId, from, to],
      );

      if (rows.length > 0) {
        const now = new Date();
        const values = rows.map((r) => [
          locationId,
          r.item_id,
          r.sale_date instanceof Date ? toDateStr(r.sale_date) : String(r.sale_date),
          Number(r.units_sold),
          now,
        ]);
        await pool.query(
          `INSERT INTO ${appSchema}.item_sales_daily (location_id, item_id, sale_date, units_sold, updated_at)
           VALUES ?
           ON DUPLICATE KEY UPDATE units_sold = VALUES(units_sold), updated_at = VALUES(updated_at)`,
          [values],
        );
        monthRows += rows.length;
      }
    }

    grandTotal += monthRows;
    console.log(`${monthRows} rows upserted`);
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\nBackfill complete: ${grandTotal} rows in ${elapsed}s\n`);

  // ── Parity check ──────────────────────────────────────────────────────────
  // Sample: compare rollup vs live for the most recent full month across all locations.
  console.log("=== Parity Check (last full month, all locations) ===\n");
  const checkFrom = monthStart(1);
  const checkTo = monthEnd(checkFrom);

  let passed = 0;
  let failed = 0;

  for (const locationId of locationIds) {
    const [[liveRow]] = await pool.execute<mysql.RowDataPacket[]>(
      PARITY_LIVE_SQL,
      [locationId, checkFrom, checkTo, locationId, checkFrom, checkTo],
    );
    const [[rollupRow]] = await pool.execute<mysql.RowDataPacket[]>(
      PARITY_ROLLUP_SQL,
      [locationId, checkFrom, checkTo],
    );

    const liveTotal = Number(liveRow.total_sold ?? 0);
    const rollupTotal = Number(rollupRow.total_sold ?? 0);
    const diff = Math.abs(liveTotal - rollupTotal);
    // Allow a tiny floating-point tolerance (< 0.001 base units).
    const ok = diff < 0.001;

    if (ok) {
      passed++;
      console.log(`  loc ${locationId}: ✓  live=${liveTotal.toFixed(2)} rollup=${rollupTotal.toFixed(2)}`);
    } else {
      failed++;
      console.error(`  loc ${locationId}: ✗  live=${liveTotal.toFixed(2)} rollup=${rollupTotal.toFixed(2)} diff=${diff.toFixed(4)}`);
    }
  }

  console.log(`\nParity: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("\n⚠  Parity check failed. Do not trust the rollup until discrepancies are resolved.");
    process.exitCode = 1;
  } else {
    console.log("\n✓  Rollup matches live data. Safe to trust for replenishment.\n");
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
  pool.end().catch(() => undefined);
});
