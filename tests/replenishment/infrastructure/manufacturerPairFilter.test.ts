import { describe, it, expect } from "vitest";
import { buildManufacturerPairFilter } from "@/replenishment/infrastructure/manufacturerPairFilter";

describe("buildManufacturerPairFilter", () => {
  it("produces an empty clause (no filter) for undefined or empty pairs", () => {
    expect(buildManufacturerPairFilter("si", undefined)).toEqual({ clause: "", params: [] });
    expect(buildManufacturerPairFilter("si", [])).toEqual({ clause: "", params: [] });
  });

  it("emits an equality predicate for a numeric manufacturer", () => {
    expect(buildManufacturerPairFilter("si", [{ supplierId: 2, manufacturerId: 5 }])).toEqual({
      clause: "((si.supplier_id = ? AND si.MANUFACTURER_ID = ?))",
      params: [2, 5],
    });
  });

  it("emits an IS NULL predicate for a no-brand manufacturer", () => {
    expect(buildManufacturerPairFilter("si", [{ supplierId: 2, manufacturerId: null }])).toEqual({
      clause: "((si.supplier_id = ? AND si.MANUFACTURER_ID IS NULL))",
      params: [2],
    });
  });

  it("OR-joins multiple pairs and keeps params positional with the clauses", () => {
    const result = buildManufacturerPairFilter("so", [
      { supplierId: 2, manufacturerId: 5 },
      { supplierId: 3, manufacturerId: null },
    ]);
    expect(result.clause).toBe(
      "((so.supplier_id = ? AND so.MANUFACTURER_ID = ?) OR (so.supplier_id = ? AND so.MANUFACTURER_ID IS NULL))",
    );
    expect(result.params).toEqual([2, 5, 3]);
  });

  it("uses the supplied table alias", () => {
    expect(buildManufacturerPairFilter("x", [{ supplierId: 1, manufacturerId: 1 }]).clause).toContain(
      "x.supplier_id",
    );
  });
});
