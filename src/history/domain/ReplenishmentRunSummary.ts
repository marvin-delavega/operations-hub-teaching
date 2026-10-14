export interface ReplenishmentRunSummary {
  id: number;
  path: "standard" | "stockout";
  status: "draft" | "active" | "deleted";
  locationId: number;
  locationName: string;
  createdByUserId: number;
  createdByName: string;
  supplierCount: number;
  supplierNames: string[];
  poCount: number;
  poCodes: string[];
  lineCount: number;
  createdAt: string; // ISO datetime (UTC); display in Asia/Manila
  approvedByUserName?: string;
  approvedAt?: string;
}

export interface ReplenishmentRunDetail {
  id: number;
  path: "standard" | "stockout";
  status: "draft" | "active" | "deleted";
  locationId: number;
  locationName: string;
  createdByUserId: number;
  createdByName: string;
  rounding: "up" | "down";
  salesRangeFrom: string | null;
  salesRangeTo: string | null;
  createdAt: string;
  approvedByUserName?: string;
  approvedAt?: string;
  pos: ReplenishmentRunPoDetail[];
}

export interface ReplenishmentRunPoDetail {
  id: number;
  poCode: string;
  supplierId: number;
  supplierName: string;
  manufacturerId: number | null;
  manufacturerName: string | null;
  lines: ReplenishmentRunLineDetail[];
}

export interface ReplenishmentRunLineDetail {
  id: number;
  itemId: number;
  itemCode: string | null;
  itemDescription: string;
  unitSymbol: string;
  orderPeriodDays: number;
  salesRate: number;
  sellingAreaDemand: number | null;
  sellingAreaNames: string | null;
  effectiveAvailable: number | null;
  shelfOnHand: number | null;
  dos: number | null;
  suggestedQty: number;
  finalQty: number;
  orderedPerPiece: boolean;
  lastSoldDate: string | null;
  stockoutDailyRate: number | null;
  stockoutWindowUnits: number | null;
}
