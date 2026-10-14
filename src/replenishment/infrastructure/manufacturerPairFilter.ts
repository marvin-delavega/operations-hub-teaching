/**
 * Builds the OR-group predicate (and matching positional params) for the optional
 * per-supplier manufacturer-pair filter shared by the Standard and Stockout candidate
 * queries. `alias` is the FROM-clause table exposing `supplier_id` / `MANUFACTURER_ID`
 * columns (`si` in MySQLReplenishmentRepository, `so` in MySQLStockoutRepository).
 * Undefined/empty pairs → empty clause (no filter).
 */
export interface ManufacturerFilterPair {
  supplierId: number;
  manufacturerId: number | null;
}

export function buildManufacturerPairFilter(
  alias: string,
  pairs: ManufacturerFilterPair[] | undefined,
): { clause: string; params: number[] } {
  if (!pairs || pairs.length === 0) return { clause: "", params: [] };

  const predicates: string[] = [];
  const params: number[] = [];
  for (const { supplierId, manufacturerId } of pairs) {
    if (manufacturerId === null) {
      predicates.push(`(${alias}.supplier_id = ? AND ${alias}.MANUFACTURER_ID IS NULL)`);
      params.push(supplierId);
    } else {
      predicates.push(`(${alias}.supplier_id = ? AND ${alias}.MANUFACTURER_ID = ?)`);
      params.push(supplierId, manufacturerId);
    }
  }
  return { clause: `(${predicates.join(" OR ")})`, params };
}
