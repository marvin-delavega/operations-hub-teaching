import type { SupplierGroup } from "../domain/ReplenishmentItem";
import type { ReplenishmentRepository, SafetyStockConfig } from "../domain/ReplenishmentRepository";
import type { SellingAreaMapRepository } from "@/shared/domain/SellingAreaMapRepository";
import type { SalesRollupRepository } from "../domain/SalesRollupRepository";

export class GetReplenishmentGroupsUseCase {
  constructor(
    private readonly repository: ReplenishmentRepository,
    private readonly sellingAreaMap: SellingAreaMapRepository,
    private readonly salesRollup: SalesRollupRepository,
  ) {}

  async execute(
    from: Date,
    to: Date,
    locationId: number,
    supplierIds: number[],
    showAllItems = false,
    manufacturerPairs?: { supplierId: number; manufacturerId: number | null }[],
    worksheet = false,
    safetyStock?: SafetyStockConfig,
    includeIncoming = true,
    requireLocationPresence = false,
  ): Promise<SupplierGroup[]> {
    const sellingAreaIds = await this.sellingAreaMap.getSellingAreaIdsByFeeder(locationId);

    // Self-heal both directions: missing rollup days at the feeder or any mapped
    // selling area would otherwise silently read as a zero sales rate.
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];
    await this.salesRollup.ensureDaysExist(locationId, fromStr, toStr);
    for (const id of sellingAreaIds) {
      await this.salesRollup.ensureDaysExist(id, fromStr, toStr);
    }

    return this.repository.getGroups(
      from,
      to,
      locationId,
      supplierIds,
      sellingAreaIds,
      showAllItems,
      manufacturerPairs,
      worksheet,
      safetyStock,
      includeIncoming,
      requireLocationPresence,
    );
  }
}
