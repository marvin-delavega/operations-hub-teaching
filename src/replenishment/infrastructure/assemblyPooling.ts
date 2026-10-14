const MAX_CHAIN_DEPTH = 10;

/**
 * Item-id universe whose raw metric rows must be read: supplier items plus every
 * assembled item pooled into one of them (descendants hold the inventory/PO/sales rows).
 */
export const ASSEMBLY_SCOPE_EXPR = "(SELECT item_id FROM pool_scope)";

/** Applied inside supplier_items so pooled assembled outputs never surface as rows. */
export const ASSEMBLY_EXCLUSION_CLAUSE =
  "AND it.ID NOT IN (SELECT start_item_id FROM resolved)";

export function assemblyRemapJoin(sourceExpr: string): string {
  return `LEFT JOIN resolved rm ON rm.start_item_id = ${sourceExpr}`;
}

export function assemblyRemappedKey(columnExpr: string): string {
  return `COALESCE(rm.root_item_id, ${columnExpr})`;
}

export function assemblyRemapRatio(): string {
  return "COALESCE(rm.ratio, 1)";
}

/**
 * Builds the CTEs that resolve assembled items to their root purchased item.
 *
 * `item_components`: ITEM_ID = assembled output, COMPONENT_ID = input,
 * QUANTITY = input units consumed per 1 output unit — ratio multiplies child base
 * units into root base units. Assumed grain; verify against live data with
 * scripts/check-assembly-components.sql before trusting suggestions.
 *
 * Fail-safe rules:
 * - only single-component assemblies pool (multi-ingredient recipes would order
 *   every ingredient at full demand);
 * - chains stop at depth MAX_CHAIN_DEPTH (cycle guard);
 * - a chain resolves only to an active root whose preferred vendor is among the
 *   selected suppliers; anything unresolvable behaves exactly as before pooling.
 *
 * vendorListSql is the parenthesised placeholder list for the selected suppliers
 * ("?" for pool.query array expansion, "?, ?, ..." for pool.execute).
 */
export function buildAssemblyLeadCtes(aoSchema: string, vendorListSql: string): string {
  return `
component_counts AS (
  SELECT ITEM_ID, COUNT(*) AS component_count
  FROM ${aoSchema}.item_components
  GROUP BY ITEM_ID
),
assembly_paths AS (
  SELECT ic.ITEM_ID AS start_item_id,
         ic.COMPONENT_ID AS current_item_id,
         COALESCE(ic.QUANTITY, 1) AS ratio,
         1 AS depth
  FROM ${aoSchema}.item_components ic
  JOIN component_counts cc ON cc.ITEM_ID = ic.ITEM_ID AND cc.component_count = 1
  UNION ALL
  SELECT ap.start_item_id,
         ic.COMPONENT_ID AS current_item_id,
         ap.ratio * COALESCE(ic.QUANTITY, 1) AS ratio,
         ap.depth + 1 AS depth
  FROM assembly_paths ap
  JOIN ${aoSchema}.item_components ic ON ic.ITEM_ID = ap.current_item_id
  JOIN component_counts cc ON cc.ITEM_ID = ap.current_item_id AND cc.component_count = 1
  WHERE ap.depth < ${MAX_CHAIN_DEPTH}
),
resolved AS (
  SELECT ap.start_item_id,
         ap.current_item_id AS root_item_id,
         ap.ratio
  FROM assembly_paths ap
  JOIN ${aoSchema}.item rt ON rt.ID = ap.current_item_id
  LEFT JOIN component_counts rc ON rc.ITEM_ID = ap.current_item_id
  WHERE COALESCE(rc.component_count, 0) = 0
    AND rt.INACTIVE = 0
    AND rt.PREFERRED_VENDOR_ID IN (${vendorListSql})
),
`;
}

/** Must be declared after supplier_items (it unions from it). */
export function buildAssemblyScopeCte(): string {
  return `
pool_scope AS (
  SELECT item_id FROM supplier_items
  UNION
  SELECT start_item_id FROM resolved
),
`;
}
