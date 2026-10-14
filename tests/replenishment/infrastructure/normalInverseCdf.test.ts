import { describe, it, expect } from "vitest";
import { inverseNormalCdf } from "@/replenishment/infrastructure/normalInverseCdf";

describe("inverseNormalCdf", () => {
  it("returns 0 at the median and for NaN", () => {
    expect(inverseNormalCdf(0.5)).toBe(0);
    expect(inverseNormalCdf(NaN)).toBe(0);
  });

  it("matches known standard-normal critical values", () => {
    expect(inverseNormalCdf(0.9)).toBeCloseTo(1.28155, 4);
    expect(inverseNormalCdf(0.95)).toBeCloseTo(1.64485, 4);
    expect(inverseNormalCdf(0.975)).toBeCloseTo(1.95996, 4);
    expect(inverseNormalCdf(0.99)).toBeCloseTo(2.32635, 4);
  });

  it("is antisymmetric about the median", () => {
    expect(inverseNormalCdf(0.1)).toBeCloseTo(-inverseNormalCdf(0.9), 9);
    expect(inverseNormalCdf(0.025)).toBeCloseTo(-inverseNormalCdf(0.975), 9);
  });

  it("increases monotonically across the probability range", () => {
    const points = [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99];
    const values = points.map(inverseNormalCdf);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it("clamps probabilities outside (0, 1) to a large finite tail value", () => {
    const low = inverseNormalCdf(0);
    const high = inverseNormalCdf(1);
    expect(Number.isFinite(low)).toBe(true);
    expect(Number.isFinite(high)).toBe(true);
    expect(low).toBeLessThan(-5);
    expect(high).toBeGreaterThan(4);
  });
});
