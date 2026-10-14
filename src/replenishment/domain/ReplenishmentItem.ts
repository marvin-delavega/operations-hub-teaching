export interface ReplenishmentItem {
  sku: string;
  description: string;
  supplierId: string;
  supplierName: string;
  supplierLeadTime: number;
  availableStock: number;
  incoming: number;
  /** Underserved qty from the most recent PO in the last 30 days (purchase units). 0 = no qualifying PO. */
  underservedQuantity: number;
  dailySalesRate: number;
  /** Portion of dailySalesRate contributed by mapped selling areas (purchase units). */
  sellingAreaDemand: number;
  /** Names of selling areas contributing to sellingAreaDemand. */
  sellingAreaNames: string[];
  /** null = no sales rate in range, DOS undefined (division by zero). */
  daysOfSupply: number | null;
  isCritical: boolean;
  unitSymbol: string;
  unitId: number;
  baseUnitSymbol: string;
  conversionFactor: number;
  manufacturerId: number | null;
  manufacturerName: string | null;
  /** Item cost per base unit (item.COST). Used to compute the ₱ running total client-side. */
  unitCost: number;
  /** Z-score-driven safety stock buffer in purchase units. 0 when disabled or demand is stable. */
  safetyStockUnits: number;
}

import type { DueStatus } from "@/shared/domain/SupplierSchedule";

export interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  leadTimeDays: number;
  items: ReplenishmentItem[];
  dueStatus?: DueStatus;
  minOrderValue?: number | null;
  minOrderQuantity?: number | null;
}
