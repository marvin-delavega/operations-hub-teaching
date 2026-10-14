export interface StockoutItem {
  sku: string;
  description: string;
  supplierId: string;
  supplierName: string;
  supplierLeadTime: number;
  lastSaleDate: string;      // YYYY-MM-DD; the most recent date with a sale at this location
  windowUnitsSold: number;   // purchase units sold in the 30-day window ending at lastSaleDate
  dailySalesRate: number;    // purchase units per day = windowBaseUnits / 30 / conversionFactor
  unitSymbol: string;
  unitId: number;
  baseUnitSymbol: string;
  conversionFactor: number;
  manufacturerId: number | null;
  manufacturerName: string | null;
  unitCost: number;
}

export interface StockoutSupplierGroup {
  supplierId: string;
  supplierName: string;
  leadTimeDays: number;
  items: StockoutItem[];     // sorted by lastSaleDate desc, then sku asc
}
