import type { RowDataPacket } from "mysql2";
import pool, { activeoneSchemaName } from "@/shared/infrastructure/db";
import type { ReplenishmentSummaryRepository, ReplenishmentSummaryRow } from "../domain/ReplenishmentSummary";
import type { SalesRollupRepository } from "../domain/SalesRollupRepository";
import { ORDER_PERIODS } from "../domain/orderPeriods";
import { PO_OPEN_STATUS, LEAD_TIME_FIELD, VENDOR_CONTACT_TYPE } from "@/shared/infrastructure/activeoneConstants";

interface SummaryRow extends RowDataPacket {
  location_id: number;
  location_name: string;
  supplier_id: number;
  supplier_name: string;
  items_to_order: number;
  computed_at: Date;
}

interface OrderCountRow extends RowDataPacket {
  location_id: number;
  location_name: string;
  supplier_id: number;
  supplier_name: string;
  items_to_order: number;
}

// Badge counts items needing an order within the shortest selectable order period,
// mirroring the replenishment screen's per-item filter (suggested order qty > 0).
const BADGE_ORDER_PERIOD_DAYS = ORDER_PERIODS[0]; // 7

// The window today-30 .. today spans 31 inclusive calendar days, so the daily rate
// divides by 31 — matching the screen's daysInRangeInclusive(daysAgo(30), today())
// so the badge and the replenishment screen surface the same items. Anchored on the
// same JS "today" the screen uses (rollup reads, not CURDATE()).
const SALES_WINDOW_DAYS = 31;

// Computes, across ALL active locations × suppliers in ActiveOne, the count of items
// whose suggested order qty > 0 for a BADGE_ORDER_PERIOD_DAYS order window.
// Suggested qty (default round-up) is positive exactly when the raw need is positive:
//   daily_sales_rate × (order_period + lead_time) − (on_hand + incoming) > 0.
// The purchase-unit conversion factor cancels in that strict inequality, so the test
// runs in base units. Items with daily_sales_rate = 0 are excluded (units_sold > 0).
//
// The sold_30d CTE reads the pre-aggregated item_sales_daily rollup over the window
// [?, ?] (from, to) instead of scanning raw invoice/receipt lines. The caller self-heals
// the rollup for all locations over that window before this query runs.
const RECOMPUTE_SQL = (ao: string) => `
WITH item_info AS (
  SELECT it.ID AS item_id, it.PREFERRED_VENDOR_ID AS supplier_id,
         COALESCE(CAST(NULLIF(c.${LEAD_TIME_FIELD}, '') AS UNSIGNED), 0) AS lead_time_days
  FROM ${ao}.item it
  JOIN ${ao}.contact c ON c.ID = it.PREFERRED_VENDOR_ID AND c.INACTIVE = 0 AND c.TYPE = ${VENDOR_CONTACT_TYPE}
  WHERE it.INACTIVE = 0 AND it.PREFERRED_VENDOR_ID IS NOT NULL
),
on_hand AS (
  SELECT inv.ITEM_ID AS item_id, inv.LOCATION_ID AS location_id,
         SUM(inv.ENDING_QUANTITY) AS on_hand
  FROM ${ao}.item_inventory inv
  JOIN (
    SELECT ITEM_ID, LOCATION_ID, BATCH_ID, MAX(SEQUENCE_NO) AS max_seq
    FROM ${ao}.item_inventory
    WHERE ITEM_ID IN (SELECT item_id FROM item_info)
    GROUP BY ITEM_ID, LOCATION_ID, BATCH_ID
  ) latest
    ON latest.ITEM_ID   = inv.ITEM_ID
    AND latest.LOCATION_ID = inv.LOCATION_ID
    AND latest.BATCH_ID  = inv.BATCH_ID
    AND latest.max_seq   = inv.SEQUENCE_NO
  GROUP BY inv.ITEM_ID, inv.LOCATION_ID
),
incoming AS (
  -- Undelivered qty in BASE units: ordered base (QUANTITY × per-unit UNIT_BASE_QUANTITY)
  -- minus RECEIVED_QTY, which ActiveOne already stores in base units.
  SELECT poi.ITEM_ID AS item_id, po.LOCATION_ID AS location_id,
         SUM(poi.QUANTITY * COALESCE(poi.UNIT_BASE_QUANTITY, 1) - COALESCE(poi.RECEIVED_QTY, 0)) AS incoming
  FROM ${ao}.purchase_order_items poi
  JOIN ${ao}.purchase_order po ON po.ID = poi.PO_ID AND po.STATUS = ?
  WHERE COALESCE(poi.CLOSED, 0) = 0
    AND (poi.QUANTITY * COALESCE(poi.UNIT_BASE_QUANTITY, 1) - COALESCE(poi.RECEIVED_QTY, 0)) > 0
    AND poi.ITEM_ID IN (SELECT item_id FROM item_info)
  GROUP BY poi.ITEM_ID, po.LOCATION_ID
),
sold_30d AS (
  SELECT isd.item_id, isd.location_id, SUM(isd.units_sold) AS units_sold
  FROM item_sales_daily isd
  WHERE isd.sale_date BETWEEN ? AND ?
    AND isd.item_id IN (SELECT item_id FROM item_info)
  GROUP BY isd.item_id, isd.location_id
),
item_need AS (
  SELECT
    s.location_id, ii.supplier_id,
    (s.units_sold / ${SALES_WINDOW_DAYS}.0) * (${BADGE_ORDER_PERIOD_DAYS} + ii.lead_time_days)
      - (COALESCE(oh.on_hand, 0) + COALESCE(inc.incoming, 0)) AS suggested_base
  FROM sold_30d s
  JOIN item_info ii ON ii.item_id = s.item_id
  LEFT JOIN on_hand  oh  ON oh.item_id  = s.item_id AND oh.location_id  = s.location_id
  LEFT JOIN incoming inc ON inc.item_id = s.item_id AND inc.location_id = s.location_id
  WHERE s.units_sold > 0
),
order_counts AS (
  SELECT n.location_id, n.supplier_id, COUNT(*) AS items_to_order
  FROM item_need n
  WHERE n.suggested_base > 0
  GROUP BY n.location_id, n.supplier_id
  HAVING COUNT(*) > 0
)
SELECT oc.location_id, l.NAME AS location_name,
       oc.supplier_id, c.NAME AS supplier_name,
       oc.items_to_order
FROM order_counts oc
JOIN ${ao}.location l ON l.ID = oc.location_id
JOIN ${ao}.contact  c ON c.ID = oc.supplier_id
ORDER BY l.NAME, c.NAME
`;

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

export class MySQLReplenishmentSummaryRepository implements ReplenishmentSummaryRepository {
  constructor(private readonly salesRollupRepository: SalesRollupRepository) {}

  async getAll(): Promise<ReplenishmentSummaryRow[]> {
    const [rows] = await pool.query<SummaryRow[]>(
      `SELECT location_id, location_name, supplier_id, supplier_name, items_to_order, computed_at
       FROM replenishment_summary
       ORDER BY location_name, supplier_name`,
    );
    return rows.map((r) => ({
      locationId: r.location_id,
      locationName: r.location_name,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      itemsToOrder: r.items_to_order,
      computedAt: r.computed_at.toISOString(),
    }));
  }

  async recompute(): Promise<Date> {
    // Window: today-30 .. today (31 inclusive days = SALES_WINDOW_DAYS), anchored on the
    // same JS "today" the replenishment screen uses.
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 30);
    const fromStr = toDateStr(from);
    const toStr = toDateStr(to);

    // Self-heal the rollup for every location over the window so a missed nightly never
    // undercounts the badge — mirrors the replenishment screen's read-time self-heal.
    await this.salesRollupRepository.ensureDaysExistAllLocations(fromStr, toStr);

    const [orderRows] = await pool.query<OrderCountRow[]>(RECOMPUTE_SQL(activeoneSchemaName()), [PO_OPEN_STATUS, fromStr, toStr]);

    const computedAt = new Date();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM replenishment_summary");

      if (orderRows.length > 0) {
        const values = orderRows.map((r) => [
          r.location_id,
          r.location_name,
          r.supplier_id,
          r.supplier_name,
          r.items_to_order,
          computedAt,
        ]);
        await conn.query(
          `INSERT INTO replenishment_summary
           (location_id, location_name, supplier_id, supplier_name, items_to_order, computed_at)
           VALUES ?`,
          [values],
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return computedAt;
  }
}
