// Shared `manufacturerIds` URL-param encoding: a comma-separated list of per-supplier
// manufacturer tokens `{supplierId}:{manufacturerId|nb}` ("nb" = No Brand / null
// manufacturer). Absent/empty param = no filter (all manufacturers).
//
// Used by the /manufacturer selection screen, the replenishment run screen (indicator +
// Change link), and both run API routes (Standard + Stockout) so client and server agree
// on the same encoding.

export interface ManufacturerPair {
  supplierId: number;
  manufacturerId: number | null;
}

export function manufacturerToken(supplierId: number, manufacturerId: number | null): string {
  return `${supplierId}:${manufacturerId ?? "nb"}`;
}

/** Parses a comma-separated `manufacturerIds` param. Absent/empty/all-invalid → null (no filter). */
export function parseManufacturerTokens(param: string | null | undefined): ManufacturerPair[] | null {
  if (!param) return null;

  const pairs: ManufacturerPair[] = [];
  for (const raw of param.split(",")) {
    const token = raw.trim();
    if (!token) continue;

    const [supplierIdStr, manufacturerIdStr] = token.split(":");
    const supplierId = Number(supplierIdStr);
    if (!Number.isInteger(supplierId) || supplierId <= 0) continue;

    if (manufacturerIdStr === "nb") {
      pairs.push({ supplierId, manufacturerId: null });
      continue;
    }

    const manufacturerId = Number(manufacturerIdStr);
    if (!Number.isInteger(manufacturerId) || manufacturerId <= 0) continue;
    pairs.push({ supplierId, manufacturerId });
  }

  return pairs.length > 0 ? pairs : null;
}

export function serializeManufacturerTokens(pairs: ManufacturerPair[]): string {
  return pairs.map((p) => manufacturerToken(p.supplierId, p.manufacturerId)).join(",");
}
