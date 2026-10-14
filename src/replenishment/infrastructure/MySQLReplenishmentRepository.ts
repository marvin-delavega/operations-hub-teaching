import type { RowDataPacket } from "mysql2";
import pool, { activeoneSchemaName } from "@/shared/infrastructure/db";
import type { ReplenishmentRepository, SafetyStockConfig } from "../domain/ReplenishmentRepository";
import type { ReplenishmentItem, SupplierGroup } from "../domain/ReplenishmentItem";
import { MAX_ORDER_PERIOD } from "../domain/orderPeriods";
import { PO_OPEN_STATUS, LEAD_TIME_FIELD } from "@/shared/infrastructure/activeoneConstants";
import { buildManufacturerPairFilter } from "./manufacturerPairFilter";
import { inverseNormalCdf } from "./normalInverseCdf";
import {
  ASSEMBLY_EXCLUSION_CLAUSE,
  ASSEMBLY_SCOPE_EXPR,
  assemblyRemapJoin,
  assemblyRemapRatio,
  assemblyRemappedKey,
  buildAssemblyLeadCtes,
  buildAssemblyScopeCte,
} from "./assemblyPooling";

interface CandidateRow extends RowDataPacket {
  item_code: string;
  description: string;
  supplier_id: number;
  supplier_name: string;
  lead_time_days: number;
  on_hand: string;            // mysql2 returns DECIMAL as string
  incoming: string;
  units_sold: string;
  shelf_units: string;        // selling-area portion, 0 when no selling areas
  shelf_areas: string | null; // comma-separated selling-area names
  unit_id: number;
  conversion_factor: string;  // DECIMAL as string; base units per 1 purchase unit
  unit_symbol: string;
  base_unit_symbol: string;
  manufacturer_id: number | null;
  manufacturer_name: string | null;
  unit_cost: string;          // item.COST per base unit; DECIMAL as string
  underserved_qty: string;   // base-unit underserved from most recent PO (30-day window); DECIMAL as string
  daily_stddev: number | null; // STDDEV_SAMP of daily base-unit sales; NULL when daily_stats omitted or < 2 data points
  avg_daily_sales: string | null; // AVG of daily base-unit totals (days-with-sales); DECIMAL as string
  max_daily_sales: string | null; // MAX of daily base-unit totals; DECIMAL as string
}

/**
 * One row per candidate item (a supplier's active item that has sold in range).
 * Returns raw numbers — on_hand, incoming, units_sold — and lets this repository
 * do the replenishment arithmetic, mirroring SeedReplenishmentRepository exactly.
 *
 * The `sold` CTE reads from `item_sales_daily` (pre-aggregated rollup) instead of
 * scanning raw invoice/sales-receipt lines. The caller ensures the rollup covers the
 * requested range before this query runs (self-heal via ensureDaysExist).
 *
 * When sellingAreaIds is non-empty the `sold` CTE is expanded to sum across the
 * feeder plus all mapped selling areas. A `shelf` CTE isolates the selling-area
 * portion for the breakdown column.
 *
 * `manufacturerClause` (built by buildManufacturerPairFilter) is an optional OR-group
 * of (si.supplier_id, si.MANUFACTURER_ID) predicates ANDed onto the final WHERE — the
 * server-side manufacturer filter fed from the /manufacturer selection step.
 */
function buildCandidatesSQL(hasSellingAreas: boolean, manufacturerClause: string, showAllItems: boolean, worksheet: boolean, dailyStatsEnabled: boolean, requireLocationPresence: boolean): string {
  const ao = activeoneSchemaName();
  const soldLocationFilter = hasSellingAreas
    ? "isd.location_id IN (?)"
    : "isd.location_id = ?";

  const shelfCte = hasSellingAreas
    ? `shelf AS (
  SELECT ${assemblyRemappedKey("isd.item_id")} AS item_id,
         SUM(isd.units_sold * ${assemblyRemapRatio()}) AS shelf_units,
         GROUP_CONCAT(DISTINCT loc.NAME ORDER BY loc.NAME SEPARATOR ', ') AS shelf_areas
  FROM item_sales_daily isd
  JOIN ${ao}.location loc ON loc.ID = isd.location_id
  ${assemblyRemapJoin("isd.item_id")}
  WHERE isd.location_id IN (?) AND isd.sale_date BETWEEN ? AND ?
    AND isd.item_id IN (${ASSEMBLY_SCOPE_EXPR})
  GROUP BY ${assemblyRemappedKey("isd.item_id")}
),`
    : "";

  const dailyStatsCte = dailyStatsEnabled
    ? `daily_stats AS (
  SELECT item_id,
         STDDEV_SAMP(daily_total) AS daily_stddev,
         AVG(daily_total)        AS avg_daily_sales,
         MAX(daily_total)        AS max_daily_sales
  FROM (
    SELECT ${assemblyRemappedKey("isd.item_id")} AS item_id, isd.sale_date,
           SUM(isd.units_sold * ${assemblyRemapRatio()}) AS daily_total
    FROM item_sales_daily isd
    ${assemblyRemapJoin("isd.item_id")}
    WHERE ${soldLocationFilter} AND isd.sale_date BETWEEN ? AND ?
      AND isd.item_id IN (${ASSEMBLY_SCOPE_EXPR})
    GROUP BY ${assemblyRemappedKey("isd.item_id")}, isd.sale_date
  ) daily
  GROUP BY item_id
),`
    : "";

  const shelfJoin = hasSellingAreas
    ? "LEFT JOIN shelf sh ON sh.item_id = si.item_id"
    : "";

  const dailyStatsJoin = dailyStatsEnabled
    ? "LEFT JOIN daily_stats ds ON ds.item_id = si.item_id"
    : "";

  const shelfSelect = hasSellingAreas
    ? `COALESCE(sh.shelf_units, 0) AS shelf_units,
  sh.shelf_areas,`
    : `0 AS shelf_units,
  NULL AS shelf_areas,`;

  const dailyStatsSelect = dailyStatsEnabled
    ? `ds.daily_stddev,
  ds.avg_daily_sales,
  ds.max_daily_sales,`
    : `NULL AS daily_stddev,
  NULL AS avg_daily_sales,
  NULL AS max_daily_sales,`;

  const presencePredicate = requireLocationPresence
    ? ` AND (
    EXISTS (
      SELECT 1 FROM ${ao}.item_inventory pf_inv
      WHERE pf_inv.ITEM_ID = si.item_id AND pf_inv.LOCATION_ID = ?
    )
    OR EXISTS (
      SELECT 1 FROM item_sales_daily pf_sd
      WHERE pf_sd.item_id = si.item_id AND pf_sd.location_id IN (?)
    )
    OR EXISTS (
      SELECT 1 FROM resolved pf_rm
      JOIN ${ao}.item_inventory pf_inv
        ON pf_inv.ITEM_ID = pf_rm.start_item_id AND pf_inv.LOCATION_ID = ?
      WHERE pf_rm.root_item_id = si.item_id
    )
    OR EXISTS (
      SELECT 1 FROM resolved pf_rm
      JOIN item_sales_daily pf_sd
        ON pf_sd.item_id = pf_rm.start_item_id AND pf_sd.location_id IN (?)
      WHERE pf_rm.root_item_id = si.item_id
    )
  )`
    : "";

  const hasFinalWhereFilters = Boolean(manufacturerClause) || Boolean(presencePredicate);

  const finalWhere = worksheet || showAllItems
    ? (hasFinalWhereFilters ? `WHERE TRUE${presencePredicate}${manufacturerClause ? ` AND ${manufacturerClause}` : ""}` : "")
    : `WHERE COALESCE(sd.units_sold, 0) > 0${presencePredicate}${manufacturerClause ? ` AND ${manufacturerClause}` : ""}`;

  return `
WITH RECURSIVE
${buildAssemblyLeadCtes(ao, "?")}
supplier_items AS (
  SELECT it.ID AS item_id, it.CODE, it.DESCRIPTION, it.PREFERRED_VENDOR_ID AS supplier_id,
         it.PURCHASES_UNIT_ID, it.BASE_UNIT_ID, it.MANUFACTURER_ID, it.COST
  FROM ${ao}.item it
  WHERE it.INACTIVE = 0 AND it.PREFERRED_VENDOR_ID IN (?)
    ${ASSEMBLY_EXCLUSION_CLAUSE}
),
${buildAssemblyScopeCte()}
on_hand AS (
  SELECT ${assemblyRemappedKey("inv.ITEM_ID")} AS item_id,
         SUM(inv.ENDING_QUANTITY * ${assemblyRemapRatio()}) AS on_hand
  FROM ${ao}.item_inventory inv
  ${assemblyRemapJoin("inv.ITEM_ID")}
  JOIN (
    SELECT ITEM_ID, BATCH_ID, MAX(SEQUENCE_NO) AS max_seq
    FROM ${ao}.item_inventory
    WHERE LOCATION_ID = ? AND ITEM_ID IN (${ASSEMBLY_SCOPE_EXPR})
    GROUP BY ITEM_ID, BATCH_ID
  ) latest
    ON latest.ITEM_ID = inv.ITEM_ID AND latest.BATCH_ID = inv.BATCH_ID AND latest.max_seq = inv.SEQUENCE_NO
  WHERE inv.LOCATION_ID = ?
  GROUP BY ${assemblyRemappedKey("inv.ITEM_ID")}
),
incoming AS (
  -- Undelivered qty in BASE units: ordered base (QUANTITY × per-unit UNIT_BASE_QUANTITY)
  -- minus RECEIVED_QTY, which ActiveOne already stores in base units.
  SELECT ${assemblyRemappedKey("poi.ITEM_ID")} AS item_id,
         SUM((poi.QUANTITY * COALESCE(poi.UNIT_BASE_QUANTITY, 1) - COALESCE(poi.RECEIVED_QTY, 0)) * ${assemblyRemapRatio()}) AS incoming
  FROM ${ao}.purchase_order_items poi
  JOIN ${ao}.purchase_order po ON po.ID = poi.PO_ID
  ${assemblyRemapJoin("poi.ITEM_ID")}
  WHERE po.LOCATION_ID = ? AND po.STATUS = ?
    AND COALESCE(poi.CLOSED, 0) = 0
    AND (poi.QUANTITY * COALESCE(poi.UNIT_BASE_QUANTITY, 1) - COALESCE(poi.RECEIVED_QTY, 0)) > 0
    AND poi.ITEM_ID IN (${ASSEMBLY_SCOPE_EXPR})
  GROUP BY ${assemblyRemappedKey("poi.ITEM_ID")}
),
sold AS (
  -- Reads the pre-aggregated rollup. When selling areas are configured the filter
  -- covers feeder + all mapped selling areas so the combined rate is computed here.
  -- Assembled items' sales are pooled into their root item via resolved.
  SELECT ${assemblyRemappedKey("isd.item_id")} AS item_id,
         SUM(isd.units_sold * ${assemblyRemapRatio()}) AS units_sold
  FROM item_sales_daily isd
  ${assemblyRemapJoin("isd.item_id")}
  WHERE ${soldLocationFilter} AND isd.sale_date BETWEEN ? AND ?
    AND isd.item_id IN (${ASSEMBLY_SCOPE_EXPR})
  GROUP BY ${assemblyRemappedKey("isd.item_id")}
),
${dailyStatsCte}
${shelfCte}
underserved_ranked AS (
  SELECT poi.ITEM_ID AS item_id,
         GREATEST(0,
           poi.QUANTITY * COALESCE(poi.UNIT_BASE_QUANTITY, 1) - poi.RECEIVED_QTY
         ) AS underserved_base,
         ROW_NUMBER() OVER (
           PARTITION BY poi.ITEM_ID ORDER BY po.DATE DESC
         ) AS rn
  FROM ${ao}.purchase_order_items poi
  JOIN ${ao}.purchase_order po ON po.ID = poi.PO_ID
  WHERE po.LOCATION_ID = ?
    AND po.DATE >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    AND poi.RECEIVED_QTY > 0
    AND poi.ITEM_ID IN (${ASSEMBLY_SCOPE_EXPR})
),
underserved AS (
  SELECT ${assemblyRemappedKey("ur.item_id")} AS item_id,
         SUM(ur.underserved_base * ${assemblyRemapRatio()}) AS underserved_base
  FROM underserved_ranked ur
  ${assemblyRemapJoin("ur.item_id")}
  WHERE ur.rn = 1
  GROUP BY ${assemblyRemappedKey("ur.item_id")}
),
_dummy AS (SELECT 1)
SELECT
  si.CODE                                                    AS item_code,
  si.DESCRIPTION                                             AS description,
  si.supplier_id,
  c.NAME                                                     AS supplier_name,
  COALESCE(CAST(NULLIF(c.${LEAD_TIME_FIELD}, '') AS UNSIGNED), 0) AS lead_time_days,
  COALESCE(oh.on_hand, 0)                                    AS on_hand,
  COALESCE(inc.incoming, 0)                                  AS incoming,
  COALESCE(us.underserved_base, 0)                           AS underserved_qty,
  COALESCE(sd.units_sold, 0)                                 AS units_sold,
  ${dailyStatsSelect}
  ${shelfSelect}
  CASE WHEN si.PURCHASES_UNIT_ID IS NOT NULL THEN si.PURCHASES_UNIT_ID
       ELSE si.BASE_UNIT_ID END                              AS unit_id,
  COALESCE(iu.QUANTITY, 1)                                   AS conversion_factor,
  CASE WHEN si.PURCHASES_UNIT_ID IS NOT NULL THEN COALESCE(uom_p.SYMBOL, '')
       ELSE COALESCE(uom_b.SYMBOL, '') END                   AS unit_symbol,
  COALESCE(uom_b.SYMBOL, '')                                 AS base_unit_symbol,
  si.MANUFACTURER_ID                                         AS manufacturer_id,
  mfr.NAME                                                   AS manufacturer_name,
  COALESCE(si.COST, 0)                                       AS unit_cost
FROM supplier_items si
JOIN ${ao}.contact c ON c.ID = si.supplier_id
LEFT JOIN on_hand  oh  ON oh.item_id  = si.item_id
LEFT JOIN incoming inc ON inc.item_id = si.item_id
LEFT JOIN sold     sd  ON sd.item_id  = si.item_id
${dailyStatsJoin}
${shelfJoin}
LEFT JOIN underserved us ON us.item_id = si.item_id
LEFT JOIN ${ao}.item_units iu          ON iu.ITEM_ID = si.item_id AND iu.UNIT_ID = si.PURCHASES_UNIT_ID
LEFT JOIN ${ao}.unit_of_measure uom_p ON uom_p.ID = si.PURCHASES_UNIT_ID
LEFT JOIN ${ao}.unit_of_measure uom_b ON uom_b.ID = si.BASE_UNIT_ID
LEFT JOIN ${ao}.manufacturer mfr       ON mfr.ID = si.MANUFACTURER_ID
${finalWhere}
ORDER BY c.NAME, si.CODE;
`;
}

function toDateOnly(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysInRangeInclusive(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export class MySQLReplenishmentRepository implements ReplenishmentRepository {
  constructor() {}

  async getGroups(
    from: Date,
    to: Date,
    locationId: number,
    supplierIds: number[],
    sellingAreaIds: number[],
    showAllItems = false,
    manufacturerPairs?: { supplierId: number; manufacturerId: number | null }[],
    worksheet = false,
    safetyStock?: SafetyStockConfig,
    includeIncoming = true,
    requireLocationPresence = false,
  ): Promise<SupplierGroup[]> {
    if (supplierIds.length === 0) return [];

    const fromStr = toDateOnly(from);
    const toStr = toDateOnly(to);
    const days = daysInRangeInclusive(from, to);
    const hasSellingAreas = sellingAreaIds.length > 0;
    const safetyStockEnabled = safetyStock?.mode !== "off";
    const dailyStatsEnabled = safetyStock?.mode === "percentage" || safetyStock?.mode === "dynamic";

    // All location ids the sold CTE must aggregate over: feeder + selling areas.
    const soldLocationIds = hasSellingAreas ? [locationId, ...sellingAreaIds] : locationId;

    let params: unknown[];
    if (hasSellingAreas) {
      params = [
        supplierIds,                      // resolved: root vendor IN (?)
        supplierIds,                      // supplier_items IN (?)
        locationId, locationId,           // on_hand (inner + outer)
        locationId, PO_OPEN_STATUS,       // incoming
        soldLocationIds, fromStr, toStr,  // sold: feeder + selling areas
        ...(dailyStatsEnabled ? [soldLocationIds, fromStr, toStr] : []), // daily_stats
        sellingAreaIds, fromStr, toStr,   // shelf: selling areas only
        locationId,                        // underserved
      ];
    } else {
      params = [
        supplierIds,                      // resolved: root vendor IN (?)
        supplierIds,                      // supplier_items IN (?)
        locationId, locationId,           // on_hand (inner + outer)
        locationId, PO_OPEN_STATUS,       // incoming
        locationId, fromStr, toStr,       // sold: feeder only
        ...(dailyStatsEnabled ? [locationId, fromStr, toStr] : []), // daily_stats
        locationId,                        // underserved
      ];
    }

    const { clause: mfgClause, params: mfgParams } = buildManufacturerPairFilter("si", manufacturerPairs);

    // Presence predicates sit in the final WHERE, before the manufacturerClause
    // placeholders in the SQL text, so their params must be spliced first.
    // Each presence pair appears twice: direct item check + pooled-descendant check.
    const presenceSalesLocationIds = hasSellingAreas ? soldLocationIds : [locationId];
    const presenceParams: unknown[] = requireLocationPresence
      ? [locationId, presenceSalesLocationIds, locationId, presenceSalesLocationIds]
      : [];
    params.push(...presenceParams, ...mfgParams);

    const sql = buildCandidatesSQL(hasSellingAreas, mfgClause, showAllItems, worksheet, dailyStatsEnabled, requireLocationPresence);
    // pool.query (not execute): mysql2 only expands `IN (?)` for an array in query().
    const [rows] = await pool.query<CandidateRow[]>(sql, params);

    const supplierMap = new Map<string, { supplierName: string; leadTimeDays: number; items: ReplenishmentItem[] }>();

    for (const row of rows) {
      const conversionFactor = Math.max(1, Number(row.conversion_factor));
      const dailySalesRate = Number(row.units_sold) / days / conversionFactor;
      if (!showAllItems && !worksheet && dailySalesRate === 0) continue;

      const availableStock = Number(row.on_hand) / conversionFactor;
      const incoming = includeIncoming ? Number(row.incoming) / conversionFactor : 0;
      const underservedQuantity = Number(row.underserved_qty) / conversionFactor;
      const leadTime = Number(row.lead_time_days);

      const effectiveAvailable = availableStock + incoming;

      let safetyStockUnits = 0;
      if (safetyStockEnabled && safetyStock) {
        if (safetyStock.mode === "days") {
          safetyStockUnits = (safetyStock.days ?? 0) * dailySalesRate;
        } else {
          const dailyStdDev = row.daily_stddev != null ? Number(row.daily_stddev) : 0;
          if (dailyStdDev > 0) {
            const z =
              safetyStock.mode === "percentage"
                ? inverseNormalCdf(safetyStock.level / 100)
                : Math.min(
                    Math.max(
                      0,
                      (Number(row.max_daily_sales ?? 0) - Number(row.avg_daily_sales ?? 0)) / dailyStdDev,
                    ),
                    inverseNormalCdf(safetyStock.maxLevel / 100),
                  );
            safetyStockUnits = (z * dailyStdDev * Math.sqrt(leadTime)) / conversionFactor;
          }
        }
      }

      // Filter at the largest selectable period so the result is the superset of
      // candidates; the client narrows per-supplier as the order period changes.
      // When showAllItems or worksheet is on, skip this filter so items with
      // sufficient stock still reach the client (worksheet needs every active item).
      if (!showAllItems && !worksheet) {
        const rawOrder = dailySalesRate * (MAX_ORDER_PERIOD + leadTime) - effectiveAvailable;
        if (rawOrder <= 0 && safetyStockUnits <= 0) continue;
      }

      const daysOfSupply = dailySalesRate > 0 ? Math.round((effectiveAvailable / dailySalesRate) * 10) / 10 : null;
      const supplierId = String(row.supplier_id);

      const sellingAreaDemand = Number(row.shelf_units) / days / conversionFactor;
      const sellingAreaNames = row.shelf_areas ? row.shelf_areas.split(", ") : [];

      const item: ReplenishmentItem = {
        sku: row.item_code,
        description: row.description,
        supplierId,
        supplierName: row.supplier_name,
        supplierLeadTime: leadTime,
        availableStock,
        incoming,
        underservedQuantity,
        dailySalesRate,
        sellingAreaDemand,
        sellingAreaNames,
        daysOfSupply,
        isCritical: daysOfSupply !== null && daysOfSupply < leadTime,
        unitSymbol: row.unit_symbol,
        unitId: row.unit_id,
        baseUnitSymbol: row.base_unit_symbol,
        conversionFactor,
        manufacturerId: row.manufacturer_id ?? null,
        manufacturerName: row.manufacturer_name ?? null,
        unitCost: Number(row.unit_cost),
        safetyStockUnits,
      };

      if (!supplierMap.has(supplierId)) {
        supplierMap.set(supplierId, { supplierName: row.supplier_name, leadTimeDays: leadTime, items: [] });
      }
      supplierMap.get(supplierId)!.items.push(item);
    }

    const groups: SupplierGroup[] = [];
    for (const [supplierId, group] of supplierMap) {
      group.items.sort((a, b) => a.description.localeCompare(b.description));
      groups.push({ supplierId, ...group });
    }
    return groups;
  }
}
