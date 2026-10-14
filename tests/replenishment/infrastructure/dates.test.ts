import { describe, it, expect } from "vitest";
import { dateColumnToStr, todayManilaStr } from "@/replenishment/infrastructure/dates";

describe("dateColumnToStr", () => {
  it("formats using local calendar components, zero-padding month and day", () => {
    // Constructed with local components so the assertion is timezone-independent.
    expect(dateColumnToStr(new Date(2024, 0, 5))).toBe("2024-01-05");
    expect(dateColumnToStr(new Date(2024, 11, 31))).toBe("2024-12-31");
  });

  it("does not shift the day via UTC (the Asia/Manila off-by-one guard)", () => {
    // Local midnight formatted as UTC would land on the previous day here.
    expect(dateColumnToStr(new Date(2024, 5, 15, 0, 0, 0))).toBe("2024-06-15");
  });
});

describe("todayManilaStr", () => {
  it("returns a YYYY-MM-DD calendar string", () => {
    expect(todayManilaStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is a valid calendar date within one day of the current UTC date", () => {
    const manila = todayManilaStr();
    const parsed = new Date(`${manila}T00:00:00Z`);
    expect(Number.isNaN(parsed.getTime())).toBe(false);

    const diffDays = Math.abs(parsed.getTime() - Date.now()) / 86_400_000;
    expect(diffDays).toBeLessThan(1.5);
  });
});
