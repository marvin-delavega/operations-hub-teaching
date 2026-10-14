import type { ShelfGuideRepository, SalesDaysEnsurer } from "../domain/ShelfGuideRepository";
import type { ShelfGuideOverview } from "../domain/ShelfGuide";
import { aggregateSales, sharePercent } from "../domain/weighting";

export interface ShelfGuideOverviewInput {
  locationId?: number | null;
  from: string;
  to: string;
}

export class GetShelfGuideOverviewUseCase {
  constructor(
    private readonly repository: ShelfGuideRepository,
    private readonly salesDaysEnsurer: SalesDaysEnsurer,
  ) {}

  async execute(input: ShelfGuideOverviewInput): Promise<ShelfGuideOverview> {
    const defaultLocationId = await this.repository.getDefaultLocationId();
    const locationId =
      input.locationId ?? defaultLocationId ?? (await this.repository.getFirstActiveLocationId());

    if (locationId === null) {
      return { locationId: null, defaultLocationId, grandTotalSold: 0, suppliers: [] };
    }

    await this.salesDaysEnsurer.ensureDaysExist(locationId, input.from, input.to);
    const rows = await this.repository.getSalesByItem(locationId, input.from, input.to);
    const { suppliers, grandTotalSold } = aggregateSales(rows, input.from, input.to);

    return {
      locationId,
      defaultLocationId,
      grandTotalSold,
      suppliers: suppliers.map((supplier) => {
        const topItem = supplier.items.reduce((a, b) => (b.totalSold > a.totalSold ? b : a));
        return {
          supplierId: supplier.supplierId,
          name: supplier.name,
          itemCount: supplier.items.length,
          totalSold: supplier.totalSold,
          sharePercent: sharePercent(supplier.totalSold, grandTotalSold),
          topItem: { code: topItem.code, description: topItem.description },
        };
      }),
    };
  }
}
