export interface ReplenishmentSummaryRow {
  locationId: number;
  locationName: string;
  supplierId: number;
  supplierName: string;
  itemsToOrder: number;
  computedAt: string; // ISO 8601
}

export interface ReplenishmentSummaryRepository {
  getAll(): Promise<ReplenishmentSummaryRow[]>;
  recompute(): Promise<Date>;
}
