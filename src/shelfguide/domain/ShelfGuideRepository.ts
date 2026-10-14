export interface ShelfGuideSaleRow {
  itemId: number;
  code: string;
  description: string;
  supplierId: number;
  supplierName: string;
  saleDate: string;
  unitsSold: number;
}

export interface ShelfGuideRepository {
  getSalesByItem(locationId: number, from: string, to: string): Promise<ShelfGuideSaleRow[]>;
  getOnHandByItem(locationId: number, itemIds: number[]): Promise<Map<number, number>>;
  getFirstActiveLocationId(): Promise<number | null>;
  getDefaultLocationId(): Promise<number | null>;
}

export interface SalesDaysEnsurer {
  ensureDaysExist(locationId: number, from: string, to: string): Promise<void>;
}
