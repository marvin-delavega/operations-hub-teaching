import type { StockoutRepository } from "../domain/StockoutRepository";
import type { StockoutSupplierGroup } from "../domain/StockoutItem";

export class GetStockoutCandidatesUseCase {
  constructor(private readonly repository: StockoutRepository) {}

  async execute(
    locationId: number,
    supplierIds: number[],
    manufacturerPairs?: { supplierId: number; manufacturerId: number | null }[],
  ): Promise<StockoutSupplierGroup[]> {
    return this.repository.getCandidates(locationId, supplierIds, manufacturerPairs);
  }
}
