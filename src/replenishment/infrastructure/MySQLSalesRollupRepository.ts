import type { RowDataPacket, OkPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import pool, { activeoneSchemaName } from "@/shared/infrastructure/db";
import type { SalesRollupRepository, SalesRollupHealth } from "../domain/SalesRollupRepository";
import { dateColumnToStr, todayManilaStr } from "./dates";

// ─── SQL helpers ─────────────────────────────────────────────────────────────

/**
 * Computes per-day, per-item base units sold for a single location and date range.
 * Mirrors the live `sold` CTE filters exactly:
 *   - invoices: STATUS NOT IN (0,6,7)
 *   - sales receipts: STATUS NOT IN (0,6,7), RETURN_TRX=0, VOID_REFERENCE_NO IS NULL
 * Base units = QUANTITY × COALESCE(UNIT_BASE_QUANTITY, 1).
 * Params: [locationId, from, to, locationId, from, to]
 */
const AGGREGATE_SALES_SQL = (ao: string) => `
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

interface AggRow extends RowDataPacket {
  item_id: number;
  sale_date: Date;      // mysql2 returns DATE as JS Date
  units_sold: string;   // DECIMAL returns as string
}

interface LocationIdRow extends RowDataPacket {
  id: number;
}

interface CoverageDateRow extends RowDataPacket {
  sale_date: Date;
}

interface HealthRow extends RowDataPacket {
  total_rows: number;
  distinct_items: number;
  min_date: Date | null;   // mysql2 returns DATE columns as JS Date
  max_date: Date | null;
  last_updated: Date | null;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
// Calendar math below works on YYYY-MM-DD *strings* parsed/formatted as UTC —
// self-consistent, no timezone exposure. mysql2-returned DATE column values are
// the exception: they must go through dateColumnToStr (see ./dates.ts).

/** Returns every calendar date string (YYYY-MM-DD) in [from, to] inclusive. */
function expandDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cursor <= end) {
    dates.push(cursor.toISOString().split("T")[0]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** Returns YYYY-MM-DD for `monthsBack` months before the current Manila month start. */
function monthStart(monthsBack: number): string {
  const [year, month] = todayManilaStr().split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 - monthsBack, 1)).toISOString().split("T")[0];
}

/** Returns YYYY-MM-DD for the last day of the month that started at `monthStartStr`. */
function monthEnd(monthStartStr: string): string {
  const d = new Date(monthStartStr + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0); // last day of previous month
  return d.toISOString().split("T")[0];
}

// ─── Upsert helper ────────────────────────────────────────────────────────────

/**
 * Bulk-upsert computed rows into item_sales_daily for a specific location.
 * ON DUPLICATE KEY UPDATE absorbs re-runs (idempotent). Accepts an optional
 * transaction connection so refresh/rebuild can pair the insert with a
 * window delete atomically.
 */
async function upsertRows(
  locationId: number,
  rows: AggRow[],
  conn: PoolConnection | typeof pool = pool,
): Promise<number> {
  if (rows.length === 0) return 0;

  const now = new Date();
  const values = rows.map((r) => [
    locationId,
    r.item_id,
    dateColumnToStr(r.sale_date),
    Number(r.units_sold),
    now,
  ]);

  const [result] = await conn.query<OkPacket>(
    `INSERT INTO item_sales_daily (location_id, item_id, sale_date, units_sold, updated_at)
     VALUES ?
     ON DUPLICATE KEY UPDATE units_sold = VALUES(units_sold), updated_at = VALUES(updated_at)`,
    [values],
  );

  // affectedRows counts 1 per insert, 2 per update; normalize to logical rows touched.
  return Math.ceil(result.affectedRows / 2) || rows.length;
}

/**
 * Recomputes one location × date-window chunk with delete-then-insert in a
 * single transaction: rows for sales that were voided/returned after the last
 * refresh disappear instead of surviving as stale upsert leftovers. Rollback
 * on failure keeps the previous (stale but complete) window intact.
 */
async function replaceWindow(
  locationId: number,
  from: string,
  to: string,
): Promise<number> {
  const [rows] = await pool.execute<AggRow[]>(
    AGGREGATE_SALES_SQL(activeoneSchemaName()),
    [locationId, from, to, locationId, from, to],
  );

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `DELETE FROM item_sales_daily
       WHERE location_id = ? AND sale_date BETWEEN ? AND ?`,
      [locationId, from, to],
    );
    const affected = await upsertRows(locationId, rows, conn);
    await conn.commit();
    return affected;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class MySQLSalesRollupRepository implements SalesRollupRepository {
  // All active location IDs in ActiveOne (refreshed per call — no in-memory cache).
  private async allLocationIds(): Promise<number[]> {
    const [rows] = await pool.execute<LocationIdRow[]>(
      `SELECT ID AS id FROM ${activeoneSchemaName()}.location WHERE INACTIVE = 0`,
    );
    return rows.map((r) => r.id);
  }

  async ensureDaysExist(locationId: number, from: string, to: string): Promise<void> {
    const allDates = expandDateRange(from, to);

    const [existingRows] = await pool.execute<CoverageDateRow[]>(
      `SELECT DISTINCT sale_date
       FROM item_sales_daily
       WHERE location_id = ? AND sale_date BETWEEN ? AND ?`,
      [locationId, from, to],
    );

    const existing = new Set(existingRows.map((r) => dateColumnToStr(r.sale_date)));
    const missing = allDates.filter((d) => !existing.has(d));
    if (missing.length === 0) return;

    // Compute the full span of missing dates in one query (sparse: zero-sale days
    // produce no rows, which is correct — they simply stay absent from the table).
    const minMissing = missing[0];
    const maxMissing = missing[missing.length - 1];

    const [rows] = await pool.execute<AggRow[]>(
      AGGREGATE_SALES_SQL(activeoneSchemaName()),
      [locationId, minMissing, maxMissing, locationId, minMissing, maxMissing],
    );

    await upsertRows(locationId, rows);
  }

  async ensureDaysExistAllLocations(from: string, to: string): Promise<void> {
    const locationIds = await this.allLocationIds();
    for (const locationId of locationIds) {
      await this.ensureDaysExist(locationId, from, to);
    }
  }

  async refreshTrailingWindow(windowDays: number): Promise<{ rowsAffected: number }> {
    const today = todayManilaStr();
    const windowStart = new Date(today + "T00:00:00Z");
    windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);
    const from = windowStart.toISOString().split("T")[0];

    const locationIds = await this.allLocationIds();
    let total = 0;

    // Delete-then-insert per location so sales voided since the last refresh
    // vanish from the window instead of lingering as stale rows.
    for (const locationId of locationIds) {
      total += await replaceWindow(locationId, from, today);
    }

    return { rowsAffected: total };
  }

  async rebuild(monthsBack: number): Promise<{ rowsAffected: number }> {
    const locationIds = await this.allLocationIds();
    let total = 0;

    // Chunk by location × month to avoid long locks on the live ERP tables.
    for (let m = monthsBack; m >= 0; m--) {
      const from = monthStart(m);
      // Month end is either the last day of that month or today (for current month).
      const rawEnd = monthEnd(from);
      const today = todayManilaStr();
      const to = rawEnd > today ? today : rawEnd;

      for (const locationId of locationIds) {
        total += await replaceWindow(locationId, from, to);
      }
    }

    return { rowsAffected: total };
  }

  async getHealth(): Promise<SalesRollupHealth> {
    const [rows] = await pool.execute<HealthRow[]>(
      `SELECT
         COUNT(*)                    AS total_rows,
         COUNT(DISTINCT item_id)     AS distinct_items,
         MIN(sale_date)              AS min_date,
         MAX(sale_date)              AS max_date,
         MAX(updated_at)             AS last_updated
       FROM item_sales_daily`,
    );

    const row = rows[0];
    return {
      lastRefreshedAt: row.last_updated ?? null,
      minSaleDate: row.min_date ? dateColumnToStr(row.min_date) : null,
      maxSaleDate: row.max_date ? dateColumnToStr(row.max_date) : null,
      totalRows: Number(row.total_rows),
      distinctItems: Number(row.distinct_items),
    };
  }
}
