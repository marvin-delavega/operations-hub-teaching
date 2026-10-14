import type { ShelfGuideSaleRow } from "./ShelfGuideRepository";
import type { PriorityTier } from "./ShelfGuide";

export const HALF_LIFE_DAYS = 14;
export const PRIORITY_HIGH_SHARE = 0.5;
export const PRIORITY_MEDIUM_SHARE = 0.8;

export function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}

export function halfLifeWeight(ageDays: number): number {
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function sharePercent(part: number, whole: number): number {
  return whole > 0 ? round1((part / whole) * 100) : 0;
}

export interface AggregatedItem {
  itemId: number;
  code: string;
  description: string;
  totalSold: number;
  dailyRate: number;
}

export interface AggregatedSupplier {
  supplierId: number;
  name: string;
  totalSold: number;
  items: AggregatedItem[];
}

export interface AggregationResult {
  suppliers: AggregatedSupplier[];
  grandTotalSold: number;
}

/**
 * Groups raw per-day rollup rows into per-supplier item lists. Each item's
 * daily rate is a recency-weighted average (half-life decay) over every
 * calendar day in [from, to], so recent days weigh more than older ones.
 * Suppliers are sorted by total sold desc; items by weighted daily rate desc.
 */
export function aggregateSales(
  rows: ShelfGuideSaleRow[],
  from: string,
  to: string,
): AggregationResult {
  const totalDays = Math.max(0, daysBetween(from, to));
  let denominator = 0;
  for (let age = 0; age <= totalDays; age++) {
    denominator += halfLifeWeight(age);
  }

  interface ItemAcc {
    itemId: number;
    code: string;
    description: string;
    supplierId: number;
    supplierName: string;
    weightedSum: number;
    totalSold: number;
  }
  const items = new Map<number, ItemAcc>();

  for (const row of rows) {
    let acc = items.get(row.itemId);
    if (!acc) {
      acc = {
        itemId: row.itemId,
        code: row.code,
        description: row.description,
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        weightedSum: 0,
        totalSold: 0,
      };
      items.set(row.itemId, acc);
    }
    acc.weightedSum += row.unitsSold * halfLifeWeight(daysBetween(row.saleDate, to));
    acc.totalSold += row.unitsSold;
  }

  const suppliers = new Map<number, AggregatedSupplier>();

  for (const acc of items.values()) {
    const dailyRate = denominator > 0 ? acc.weightedSum / denominator : 0;
    let supplier = suppliers.get(acc.supplierId);
    if (!supplier) {
      supplier = { supplierId: acc.supplierId, name: acc.supplierName, totalSold: 0, items: [] };
      suppliers.set(acc.supplierId, supplier);
    }
    supplier.items.push({
      itemId: acc.itemId,
      code: acc.code,
      description: acc.description,
      totalSold: acc.totalSold,
      dailyRate,
    });
  }

  const result: AggregatedSupplier[] = [];
  let grandTotalSold = 0;
  for (const supplier of suppliers.values()) {
    supplier.items.sort((a, b) => b.dailyRate - a.dailyRate);
    supplier.totalSold = supplier.items.reduce((sum, i) => sum + i.totalSold, 0);
    grandTotalSold += supplier.totalSold;
    result.push(supplier);
  }
  result.sort((a, b) => b.totalSold - a.totalSold);

  return { suppliers: result, grandTotalSold };
}

/**
 * Pareto allocation priorities by each item's share of the supplier's total
 * sold quantity: high = cumulative share ≤ 50%, medium = ≤ 80%, low = remainder.
 */
export function assignPriorities(items: { totalSold: number }[]): PriorityTier[] {
  const total = items.reduce((sum, i) => sum + i.totalSold, 0);
  if (total <= 0) return items.map(() => "low");
  const sorted = items
    .map((item, index) => ({ index, totalSold: item.totalSold }))
    .sort((a, b) => b.totalSold - a.totalSold);
  const tiers = new Array<PriorityTier>(items.length).fill("low");
  let cumulative = 0;
  for (const { index, totalSold } of sorted) {
    cumulative += totalSold / total;
    tiers[index] =
      cumulative <= PRIORITY_HIGH_SHARE
        ? "high"
        : cumulative <= PRIORITY_MEDIUM_SHARE
          ? "medium"
          : "low";
  }
  return tiers;
}
