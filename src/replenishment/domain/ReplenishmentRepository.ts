import type { SupplierGroup } from "./ReplenishmentItem";

export type SafetyStockMode = "off" | "percentage" | "dynamic" | "days";

export interface SafetyStockConfig {
  mode: SafetyStockMode;
  /** Percentage-mode service level % (1-100). Maps to a Z-score via the inverse normal CDF. */
  level: number;
  /** Dynamic-mode cap service level % (1-99.99). Caps the data-driven z-score. */
  maxLevel: number;
  /** Days-mode buffer: days of sales added on top of the suggestion. */
  days?: number;
}

export interface ReplenishmentRepository {
  getGroups(
    from: Date,
    to: Date,
    locationId: number,
    supplierIds: number[],
    sellingAreaIds: number[],
    showAllItems?: boolean,
    // Optional per-supplier manufacturer filter (manufacturerId null = "No Brand").
    // Undefined/empty = no filter (all manufacturers).
    manufacturerPairs?: { supplierId: number; manufacturerId: number | null }[],
    // Full-catalog mode for the printable worksheet: relaxes the zero-sales,
    // zero-rate, and rawOrder<=0 exclusions so every active item is returned.
    worksheet?: boolean,
    // When set with mode !== "off", derives safetyStockUnits per item. The
    // percentage/dynamic modes need a daily_stats CTE (STDDEV_SAMP + AVG + MAX
    // from item_sales_daily); the days mode only multiplies the daily sales rate.
    safetyStock?: SafetyStockConfig,
    // When false, incoming is zeroed so it neither appears nor counts toward
    // effective stock. Defaults to true (current behavior).
    includeIncoming?: boolean,
    // When true, only items with an inventory row or rollup sale at the run
    // location / its selling areas are returned (per-location presence policy).
    requireLocationPresence?: boolean,
  ): Promise<SupplierGroup[]>;
}
