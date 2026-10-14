import { describe, it, expect } from "vitest";
import {
  manufacturerToken,
  parseManufacturerTokens,
  serializeManufacturerTokens,
} from "@/manufacturer/domain/manufacturerTokens";

describe("manufacturerToken", () => {
  it("encodes a numeric manufacturer id", () => {
    expect(manufacturerToken(2, 5)).toBe("2:5");
  });

  it("encodes a null manufacturer as 'nb'", () => {
    expect(manufacturerToken(2, null)).toBe("2:nb");
  });
});

describe("parseManufacturerTokens", () => {
  it("returns null for absent or empty input (no filter)", () => {
    expect(parseManufacturerTokens(null)).toBeNull();
    expect(parseManufacturerTokens(undefined)).toBeNull();
    expect(parseManufacturerTokens("")).toBeNull();
  });

  it("parses a mixed numeric / no-brand list, tolerating whitespace", () => {
    expect(parseManufacturerTokens(" 2:5 , 3:nb ,4:9")).toEqual([
      { supplierId: 2, manufacturerId: 5 },
      { supplierId: 3, manufacturerId: null },
      { supplierId: 4, manufacturerId: 9 },
    ]);
  });

  it("drops malformed tokens but keeps the valid ones", () => {
    expect(parseManufacturerTokens("2:5,oops,0:9,7:0,8:x")).toEqual([
      { supplierId: 2, manufacturerId: 5 },
    ]);
  });

  it("returns null when every token is invalid", () => {
    expect(parseManufacturerTokens("oops,0:9,7:0")).toBeNull();
  });

  it("round-trips through serialize", () => {
    const pairs = [
      { supplierId: 2, manufacturerId: 5 },
      { supplierId: 3, manufacturerId: null },
    ];
    expect(parseManufacturerTokens(serializeManufacturerTokens(pairs))).toEqual(pairs);
  });
});
