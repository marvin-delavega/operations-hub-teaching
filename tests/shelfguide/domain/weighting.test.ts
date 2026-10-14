import { describe, it, expect } from "vitest";
import {
  aggregateSales,
  assignPriorities,
  daysBetween,
  halfLifeWeight,
  round1,
  sharePercent,
} from "@/shelfguide/domain/weighting";
import type { ShelfGuideSaleRow } from "@/shelfguide/domain/ShelfGuideRepository";

function row(overrides: Partial<ShelfGuideSaleRow>): ShelfGuideSaleRow {
  return {
    itemId: 1,
    code: "SKU-1",
    description: "Item 1",
    supplierId: 10,
    supplierName: "Supplier A",
    saleDate: "2024-01-11",
    unitsSold: 0,
    ...overrides,
  };
}

describe("daysBetween", () => {
  it("counts whole calendar days between two ISO dates", () => {
    expect(daysBetween("2024-01-01", "2024-01-31")).toBe(30);
    expect(daysBetween("2024-01-11", "2024-01-11")).toBe(0);
    expect(daysBetween("2024-01-11", "2024-01-01")).toBe(-10);
  });
});

describe("halfLifeWeight", () => {
  it("halves every HALF_LIFE_DAYS and starts at 1", () => {
    expect(halfLifeWeight(0)).toBe(1);
    expect(halfLifeWeight(14)).toBeCloseTo(0.5, 10);
    expect(halfLifeWeight(28)).toBeCloseTo(0.25, 10);
  });
});

describe("round1 / sharePercent", () => {
  it("rounds to one decimal place", () => {
    expect(round1(1.24)).toBe(1.2);
    expect(round1(1.26)).toBe(1.3);
  });

  it("computes a rounded percentage and guards against divide-by-zero", () => {
    expect(sharePercent(1, 4)).toBe(25);
    expect(sharePercent(1, 3)).toBe(33.3);
    expect(sharePercent(5, 0)).toBe(0);
  });
});

describe("aggregateSales", () => {
  it("weights recent sales higher and sorts items by weighted daily rate", () => {
    const rows = [
      // recent, age 0 from `to`
      row({ itemId: 1, code: "RECENT", saleDate: "2024-01-11", unitsSold: 10 }),
      // oldest day in range, age 10
      row({ itemId: 2, code: "OLD", saleDate: "2024-01-01", unitsSold: 10 }),
    ];

    const { suppliers, grandTotalSold } = aggregateSales(rows, "2024-01-01", "2024-01-11");

    expect(grandTotalSold).toBe(20);
    expect(suppliers).toHaveLength(1);
    expect(suppliers[0].items.map((i) => i.code)).toEqual(["RECENT", "OLD"]);
    expect(suppliers[0].items[0].dailyRate).toBeGreaterThan(suppliers[0].items[1].dailyRate);
  });

  it("sums total sold per supplier and sorts suppliers by total sold desc", () => {
    const rows = [
      row({ itemId: 1, supplierId: 10, supplierName: "A", unitsSold: 3 }),
      row({ itemId: 2, supplierId: 10, supplierName: "A", unitsSold: 4 }),
      row({ itemId: 3, supplierId: 20, supplierName: "B", unitsSold: 9 }),
    ];

    const { suppliers, grandTotalSold } = aggregateSales(rows, "2024-01-01", "2024-01-11");

    expect(suppliers.map((s) => s.supplierId)).toEqual([20, 10]);
    expect(suppliers[0].totalSold).toBe(9);
    expect(suppliers[1].totalSold).toBe(7);
    expect(grandTotalSold).toBe(16);
  });

  it("returns an empty result for no rows", () => {
    const { suppliers, grandTotalSold } = aggregateSales([], "2024-01-01", "2024-01-11");
    expect(suppliers).toEqual([]);
    expect(grandTotalSold).toBe(0);
  });
});

describe("assignPriorities", () => {
  it("classifies by cumulative share (<=50% high, <=80% medium, else low)", () => {
    expect(assignPriorities([{ totalSold: 50 }, { totalSold: 30 }, { totalSold: 20 }])).toEqual([
      "high",
      "medium",
      "low",
    ]);
  });

  it("maps priorities back to the original item order", () => {
    expect(assignPriorities([{ totalSold: 20 }, { totalSold: 50 }, { totalSold: 30 }])).toEqual([
      "low",
      "high",
      "medium",
    ]);
  });

  it("labels everything low when there is no sales volume", () => {
    expect(assignPriorities([{ totalSold: 0 }, { totalSold: 0 }])).toEqual(["low", "low"]);
    expect(assignPriorities([])).toEqual([]);
  });

  it("has no high tier when a single item is under half the total is impossible", () => {
    // A lone item is 100% of the total, exceeding the high threshold.
    expect(assignPriorities([{ totalSold: 100 }])).toEqual(["low"]);
  });
});
