import { describe, it, expect } from "vitest";
import { coerceDbConfigInput } from "@/shared/application/CoerceDbConfigInput";
import type { DbConnectionConfig } from "@/shared/domain/DbConnectionConfig";

const existing: DbConnectionConfig = {
  host: "old-host",
  port: 3306,
  user: "old-user",
  password: "old-secret",
  database: "OldDb",
};

describe("coerceDbConfigInput", () => {
  it("trims string fields and applies the default port", () => {
    const result = coerceDbConfigInput(
      { host: "  db.local  ", user: " ops ", database: " ActiveOne " },
      null,
    );
    expect(result).toEqual({
      host: "db.local",
      port: 3306,
      user: "ops",
      password: "",
      database: "ActiveOne",
    });
  });

  it("parses a submitted port and keeps a provided password", () => {
    const result = coerceDbConfigInput({ port: "3307", password: "new-secret" }, existing);
    expect(result.port).toBe(3307);
    expect(result.password).toBe("new-secret");
  });

  it("keeps the stored password when the submitted one is blank or omitted", () => {
    expect(coerceDbConfigInput({ password: "" }, existing).password).toBe("old-secret");
    expect(coerceDbConfigInput({}, existing).password).toBe("old-secret");
  });

  it("falls back to an empty password when none is stored", () => {
    expect(coerceDbConfigInput({}, null).password).toBe("");
  });

  it("includes appDatabase only when submitted non-blank, trimmed", () => {
    expect(coerceDbConfigInput({ appDatabase: "  ops_hub " }, null).appDatabase).toBe("ops_hub");
    expect(coerceDbConfigInput({ appDatabase: "   " }, null)).not.toHaveProperty("appDatabase");
    expect(coerceDbConfigInput({}, existing)).not.toHaveProperty("appDatabase");
  });

  it("coerces missing host/user/database to empty strings", () => {
    const result = coerceDbConfigInput({}, null);
    expect(result.host).toBe("");
    expect(result.user).toBe("");
    expect(result.database).toBe("");
  });
});
