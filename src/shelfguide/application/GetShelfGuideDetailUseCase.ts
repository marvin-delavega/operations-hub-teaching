import type { ShelfGuideRepository, SalesDaysEnsurer } from "../domain/ShelfGuideRepository";
import type { ShelfGuideDetail } from "../domain/ShelfGuide";
import { aggregateSales, assignPriorities, round1, sharePercent } from "../domain/weighting";

export interface ShelfGuideDetailInput {
  supplierId: number;
  locationId?: number | null;
  from: string;
  to: string;
}

export class GetShelfGuideDetailUseCase {
  constructor(
    private readonly repository: ShelfGuideRepository,
    private readonly salesDaysEnsurer: SalesDaysEnsurer,
  ) {}

  async execute(input: ShelfGuideDetailInput): Promise<ShelfGuideDetail | null> {
    const defaultLocationId = await this.repository.getDefaultLocationId();
    const locationId =
      input.locationId ?? defaultLocationId ?? (await this.repository.getFirstActiveLocationId());

    if (locationId === null) return null;

    await this.salesDaysEnsurer.ensureDaysExist(locationId, input.from, input.to);
    const rows = await this.repository.getSalesByItem(locationId, input.from, input.to);
    const { suppliers, grandTotalSold } = aggregateSales(rows, input.from, input.to);

    const supplier = suppliers.find((s) => s.supplierId === input.supplierId);
    if (!supplier) return null;

    const tiers = assignPriorities(supplier.items);
    const onHand = await this.repository.getOnHandByItem(
      locationId,
      supplier.items.map((i) => i.itemId),
    );
    const topItem = supplier.items.reduce((a, b) => (b.totalSold > a.totalSold ? b : a));

    return {
      supplierId: supplier.supplierId,
      name: supplier.name,
      locationId,
      sharePercent: sharePercent(supplier.totalSold, grandTotalSold),
      grandTotalSold,
      topItem: { code: topItem.code, description: topItem.description, totalSold: topItem.totalSold },
      items: supplier.items.map((item, index) => ({
        code: item.code,
        description: item.description,
        dailyRate: round1(item.dailyRate),
        totalSold: item.totalSold,
        allocationPercent: sharePercent(item.totalSold, supplier.totalSold),
        priority: tiers[index],
        onDisplay: Math.round(onHand.get(item.itemId) ?? 0),
      })),
    };
  }
}
