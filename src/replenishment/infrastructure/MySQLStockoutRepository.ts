import type { RowDataPacket } from "mysql2";
import pool, { activeoneSchemaName } from "@/shared/infrastructure/db";
import type { StockoutRepository } from "../domain/StockoutRepository";
import type { StockoutItem, StockoutSupplierGroup } from "../domain/StockoutItem";
import { PO_OPEN_STATUS, LEAD_TIME_FIELD } from "@/shared/infrastructure/activeoneConstants";
import { dateColumnToStr } from "./dates";
import { buildManufacturerPairFilter } from "./manufacturerPairFilter";
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
  last_sale_date: Date;        // mysql2 returns DATE as JS Date
  window_base_units: string;   // DECIMAL as string
  unit_id: number;
  conversion_factor: string;   // DECIMAL as string; base units per 1 purchase unit
  unit_symbol: string;
  base_unit_symbol: string;
  manufacturer_id: number | null;
  manufacturer_name: string | null;
  unit_cost: string;           // item.COST per base unit; DECIMAL as string
}

/**
 * Builds the stockout candidate SQL for a given number of suppliers.
 *
 * Items where effective available (on_hand + open-PO incoming) <= 0 at the location,
 * whose preferred vendor is in the supplied list, AND that have at least one sale in
 * the item_sales_daily rollup.
 *
 * The 30-day window: [last_sale_date - 29 days, last_sale_date] inclusive (= 30 days).
 * The divisor is always 30 — never shorter — so single-day-history rates don't inflate.
 *
 * Items sort: supplier name asc, then item description alphabetically.
 *
 * Params (in order): supplierIds ×N (resolved root vendors), supplierIds ×N
 * (supplier_items), locationId ×2, locationId + PO_OPEN_STATUS, locationId ×2,
 * plus the manufacturer-pair filter's params (if active) appended last.
 *
 * `manufacturerClause` (built by buildManufacturerPairFilter) is an optional OR-group of
 * (so.supplier_id, so.MANUFACTURER_ID) predicates — the same per-supplier manufacturer
 * filter Standard applies, fed from the /manufacturer selection step (FR-19).
 */
function buildStockoutSQL(supplierCount: number, manufacturerClause: string): string {
  const ao = activeoneSchemaName();
  const supplierPlaceholders = Array(supplierCount).fill("?").join(", ");
  return `
WITH RECURSIVE
${buildAssemblyLeadCtes(ao, supplierPlaceholders)}
supplier_items AS (
  SELECT it.ID AS item_id, it.CODE, it.DESCRIPTION, it.PREFERRED_VENDOR_ID AS supplier_id,
         it.PURCHASES_UNIT_ID, it.BASE_UNIT_ID, it.MANUFACTURER_ID, it.COST
  FROM ${ao}.item it
  WHERE it.INACTIVE = 0 AND it.PREFERRED_VENDOR_ID IN (${supplierPlaceholders})
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
  ) latest ON latest.ITEM_ID = inv.ITEM_ID
           AND latest.BATCH_ID = inv.BATCH_ID
           AND latest.max_seq = inv.SEQUENCE_NO
  WHERE inv.LOCATION_ID = ?
  GROUP BY ${assemblyRemappedKey("inv.ITEM_ID")}
),
incoming AS (
  SELECT ${assemblyRemappedKey("poi.ITEM_ID")} AS item_id,
         SUM((poi.QUANTITY * COALESCE(poi.UNIT_BASE_QUANTITY, 1)
             - COALESCE(poi.RECEIVED_QTY, 0)) * ${assemblyRemapRatio()}) AS incoming
  FROM ${ao}.purchase_order_items poi
  JOIN ${ao}.purchase_order po ON po.ID = poi.PO_ID
  ${assemblyRemapJoin("poi.ITEM_ID")}
  WHERE po.LOCATION_ID = ? AND po.STATUS = ?
    AND COALESCE(poi.CLOSED, 0) = 0
    AND (poi.QUANTITY * COALESCE(poi.UNIT_BASE_QUANTITY, 1)
         - COALESCE(poi.RECEIVED_QTY, 0)) > 0
    AND poi.ITEM_ID IN (${ASSEMBLY_SCOPE_EXPR})
  GROUP BY ${assemblyRemappedKey("poi.ITEM_ID")}
),
stocked_out AS (
  SELECT si.item_id, si.CODE, si.DESCRIPTION, si.supplier_id,
         si.PURCHASES_UNIT_ID, si.BASE_UNIT_ID, si.MANUFACTURER_ID, si.COST
  FROM supplier_items si
  LEFT JOIN on_hand oh   ON oh.item_id = si.item_id
  LEFT JOIN incoming inc ON inc.item_id = si.item_id
  WHERE COALESCE(oh.on_hand, 0) + COALESCE(inc.incoming, 0) <= 0
),
last_sale AS (
  -- Sales live under descendant ids; pool through resolved and widen the scope.
  SELECT ${assemblyRemappedKey("isd.item_id")} AS item_id,
         MAX(isd.sale_date) AS last_sale_date
  FROM item_sales_daily isd
  ${assemblyRemapJoin("isd.item_id")}
  WHERE isd.location_id = ?
    AND isd.item_id IN (${ASSEMBLY_SCOPE_EXPR})
  GROUP BY ${assemblyRemappedKey("isd.item_id")}
),
window_sales AS (
  SELECT ${assemblyRemappedKey("isd.item_id")} AS item_id,
         SUM(isd.units_sold * ${assemblyRemapRatio()}) AS window_base_units
  FROM item_sales_daily isd
  ${assemblyRemapJoin("isd.item_id")}
  JOIN last_sale ls ON ls.item_id = ${assemblyRemappedKey("isd.item_id")}
  WHERE isd.location_id = ?
    AND isd.sale_date >= DATE_SUB(ls.last_sale_date, INTERVAL 29 DAY)
    AND isd.sale_date <= ls.last_sale_date
  GROUP BY ${assemblyRemappedKey("isd.item_id")}
)
SELECT
  so.CODE                                                           AS item_code,
  so.DESCRIPTION                                                    AS description,
  so.supplier_id,
  c.NAME                                                            AS supplier_name,
  COALESCE(CAST(NULLIF(c.${LEAD_TIME_FIELD}, '') AS UNSIGNED), 0)  AS lead_time_days,
  ls.last_sale_date,
  ws.window_base_units,
  CASE WHEN so.PURCHASES_UNIT_ID IS NOT NULL THEN so.PURCHASES_UNIT_ID
       ELSE so.BASE_UNIT_ID END                                     AS unit_id,
  COALESCE(iu.QUANTITY, 1)                                          AS conversion_factor,
  CASE WHEN so.PURCHASES_UNIT_ID IS NOT NULL THEN COALESCE(uom_p.SYMBOL, '')
       ELSE COALESCE(uom_b.SYMBOL, '') END                          AS unit_symbol,
  COALESCE(uom_b.SYMBOL, '')                                        AS base_unit_symbol,
  so.MANUFACTURER_ID                                                AS manufacturer_id,
  mfr.NAME                                                          AS manufacturer_name,
  COALESCE(so.COST, 0)                                              AS unit_cost
FROM stocked_out so
JOIN last_sale ls ON ls.item_id = so.item_id
JOIN window_sales ws ON ws.item_id = so.item_id
JOIN ${ao}.contact c ON c.ID = so.supplier_id
LEFT JOIN ${ao}.item_units iu         ON iu.ITEM_ID = so.item_id AND iu.UNIT_ID = so.PURCHASES_UNIT_ID
LEFT JOIN ${ao}.unit_of_measure uom_p ON uom_p.ID = so.PURCHASES_UNIT_ID
LEFT JOIN ${ao}.unit_of_measure uom_b ON uom_b.ID = so.BASE_UNIT_ID
LEFT JOIN ${ao}.manufacturer mfr      ON mfr.ID = so.MANUFACTURER_ID
${manufacturerClause ? `WHERE ${manufacturerClause}` : ""}
ORDER BY c.NAME, so.DESCRIPTION
`;
}

export class MySQLStockoutRepository implements StockoutRepository {

  async getCandidates(
    locationId: number,
    supplierIds: number[],
    manufacturerPairs?: { supplierId: number; manufacturerId: number | null }[],
  ): Promise<StockoutSupplierGroup[]> {
    const { clause: mfgClause, params: mfgParams } = buildManufacturerPairFilter("so", manufacturerPairs);

    const params = [
      ...supplierIds,             // resolved: root vendor IN (...)
      ...supplierIds,             // supplier_items: PREFERRED_VENDOR_ID IN (...)
      locationId, locationId,     // on_hand: inner ITEM_ID filter + outer LOCATION_ID
      locationId, PO_OPEN_STATUS, // incoming: LOCATION_ID + STATUS
      locationId,                 // last_sale: isd.location_id
      locationId,                 // window_sales: isd.location_id
      ...mfgParams,
    ];

    const [rows] = await pool.execute<CandidateRow[]>(
      buildStockoutSQL(supplierIds.length, mfgClause),
      params,
    );

    const supplierMap = new Map<
      string,
      { supplierName: string; leadTimeDays: number; items: StockoutItem[] }
    >();

    for (const row of rows) {
      const conversionFactor = Math.max(1, Number(row.conversion_factor));
      const windowBaseUnits = Number(row.window_base_units);

      // daily rate in purchase units — divisor is always 30 per PRD
      const dailySalesRate = windowBaseUnits / 30 / conversionFactor;
      if (dailySalesRate === 0) continue;

      const windowUnitsSold = windowBaseUnits / conversionFactor;
      const supplierId = String(row.supplier_id);

      const item: StockoutItem = {
        sku: row.item_code,
        description: row.description,
        supplierId,
        supplierName: row.supplier_name,
        supplierLeadTime: Number(row.lead_time_days),
        lastSaleDate: dateColumnToStr(row.last_sale_date),
        windowUnitsSold,
        dailySalesRate,
        unitSymbol: row.unit_symbol,
        unitId: row.unit_id,
        baseUnitSymbol: row.base_unit_symbol,
        conversionFactor,
        manufacturerId: row.manufacturer_id ?? null,
        manufacturerName: row.manufacturer_name ?? null,
        unitCost: Number(row.unit_cost),
      };

      if (!supplierMap.has(supplierId)) {
        supplierMap.set(supplierId, {
          supplierName: row.supplier_name,
          leadTimeDays: Number(row.lead_time_days),
          items: [],
        });
      }
      supplierMap.get(supplierId)!.items.push(item);
    }

    const groups: StockoutSupplierGroup[] = [];
    for (const [supplierId, group] of supplierMap) {
      groups.push({ supplierId, ...group });
    }
    return groups;
  }
}
