import { describe, it, expect } from "vitest";
import {
  validateDbConnectionConfig,
  type DbConnectionConfig,
} from "@/shared/domain/DbConnectionConfig";

function validConfig(overrides: Partial<DbConnectionConfig> = {}): DbConnectionConfig {
  return {
    host: "127.0.0.1",
    port: 3306,
    user: "ops",
    password: "secret",
    database: "ActiveOne",
    ...overrides,
  };
}

describe("validateDbConnectionConfig", () => {
  it("accepts a complete config", () => {
    expect(validateDbConnectionConfig(validConfig())).toEqual({ ok: true });
  });

  it("accepts an optional appDatabase", () => {
    expect(validateDbConnectionConfig(validConfig({ appDatabase: "ops_hub" }))).toEqual({ ok: true });
  });

  it("requires a non-blank host", () => {
    expect(validateDbConnectionConfig(validConfig({ host: "" })).ok).toBe(false);
    expect(validateDbConnectionConfig(validConfig({ host: "   " })).error).toBe("Host is required.");
  });

  it("requires a non-blank user", () => {
    expect(validateDbConnectionConfig(validConfig({ user: " " })).error).toBe("User is required.");
  });

  it("requires a non-blank database", () => {
    expect(validateDbConnectionConfig(validConfig({ database: "" })).error).toBe(
      "Database name is required.",
    );
  });

  it("rejects a non-integer or out-of-range port", () => {
    const expected = "Port must be an integer between 1 and 65535.";
    expect(validateDbConnectionConfig(validConfig({ port: 0 })).error).toBe(expected);
    expect(validateDbConnectionConfig(validConfig({ port: 70000 })).error).toBe(expected);
    expect(validateDbConnectionConfig(validConfig({ port: 3306.5 })).error).toBe(expected);
  });

  it("reports the first failure in field order", () => {
    expect(validateDbConnectionConfig(validConfig({ host: "", user: "" })).error).toBe(
      "Host is required.",
    );
  });
});
