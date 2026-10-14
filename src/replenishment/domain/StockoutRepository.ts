import type { StockoutSupplierGroup } from "./StockoutItem";

export interface StockoutRepository {
  getCandidates(
    locationId: number,
    supplierIds: number[],
    // Optional per-supplier manufacturer filter (manufacturerId null = "No Brand").
    // Undefined/empty = no filter (all manufacturers).
    manufacturerPairs?: { supplierId: number; manufacturerId: number | null }[],
  ): Promise<StockoutSupplierGroup[]>;
}
