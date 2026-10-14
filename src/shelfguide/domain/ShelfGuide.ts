export interface TopItem {
  code: string;
  description: string;
}

export interface TopItemWithSold extends TopItem {
  totalSold: number;
}

export interface ShelfGuideSupplier {
  supplierId: number;
  name: string;
  itemCount: number;
  totalSold: number;
  sharePercent: number;
  topItem: TopItem;
}

export interface ShelfGuideOverview {
  locationId: number | null;
  defaultLocationId: number | null;
  grandTotalSold: number;
  suppliers: ShelfGuideSupplier[];
}

export type PriorityTier = "high" | "medium" | "low";

export interface ShelfGuideItem {
  code: string;
  description: string;
  dailyRate: number;
  totalSold: number;
  allocationPercent: number;
  priority: PriorityTier;
  onDisplay: number;
}

export interface ShelfGuideDetail {
  supplierId: number;
  name: string;
  locationId: number | null;
  sharePercent: number;
  grandTotalSold: number;
  topItem: TopItemWithSold;
  items: ShelfGuideItem[];
}
