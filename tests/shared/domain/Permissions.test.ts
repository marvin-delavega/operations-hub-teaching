import { describe, it, expect } from "vitest";
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_CATALOG,
  hasAnyAdminTabPermission,
  isPermissionKey,
  isSensitivePermission,
  permissionsSatisfy,
  requiredPermissionForPath,
} from "@/shared/domain/Permissions";

describe("permission catalog integrity", () => {
  it("flattens every catalog group into ALL_PERMISSION_KEYS", () => {
    const grouped = PERMISSION_CATALOG.flatMap((g) => g.permissions.map((p) => p.key));
    expect(ALL_PERMISSION_KEYS).toEqual(grouped);
  });

  it("has no duplicate permission keys", () => {
    expect(new Set(ALL_PERMISSION_KEYS).size).toBe(ALL_PERMISSION_KEYS.length);
  });

  it("recognizes catalog keys and rejects unknown ones", () => {
    expect(isPermissionKey("module.delivery")).toBe(true);
    expect(isPermissionKey("admin.users")).toBe(true);
    expect(isPermissionKey("module.nope")).toBe(false);
    expect(isPermissionKey("")).toBe(false);
  });
});

describe("hasAnyAdminTabPermission", () => {
  it("is true when any permission starts with admin.", () => {
    expect(hasAnyAdminTabPermission(["module.delivery", "admin.users"])).toBe(true);
  });

  it("is false when no admin-tab permission is held", () => {
    expect(hasAnyAdminTabPermission(["module.delivery", "history.delete_run"])).toBe(false);
    expect(hasAnyAdminTabPermission([])).toBe(false);
  });
});

describe("isSensitivePermission", () => {
  it("flags admin-tab and supervisor grants as sensitive", () => {
    expect(isSensitivePermission("admin.users")).toBe(true);
    expect(isSensitivePermission("delivery.adjust_lines")).toBe(true);
    expect(isSensitivePermission("counting.adjust_lines")).toBe(true);
    expect(isSensitivePermission("replenishment.approve")).toBe(true);
  });

  it("treats module access and history actions as non-sensitive", () => {
    expect(isSensitivePermission("module.delivery")).toBe(false);
    expect(isSensitivePermission("history.delete_run")).toBe(false);
  });
});

describe("requiredPermissionForPath", () => {
  it("maps module routes to their Open-* permission", () => {
    expect(requiredPermissionForPath("/delivery")).toBe("module.delivery");
    expect(requiredPermissionForPath("/counting")).toBe("module.counting");
    expect(requiredPermissionForPath("/replenishment")).toBe("module.replenishment");
    expect(requiredPermissionForPath("/history")).toBe("module.history");
  });

  it("treats /manufacturer as gated by module.replenishment", () => {
    expect(requiredPermissionForPath("/manufacturer")).toBe("module.replenishment");
  });

  it("matches sub-paths by prefix", () => {
    expect(requiredPermissionForPath("/history/run/42")).toBe("module.history");
    expect(requiredPermissionForPath("/delivery/receiving")).toBe("module.delivery");
  });

  it("gates /admin sub-routes behind ANY_ADMIN", () => {
    expect(requiredPermissionForPath("/admin")).toBe("ANY_ADMIN");
    expect(requiredPermissionForPath("/admin/users")).toBe("ANY_ADMIN");
  });

  it("returns null for ungated routes", () => {
    expect(requiredPermissionForPath("/")).toBeNull();
    expect(requiredPermissionForPath("/login")).toBeNull();
    expect(requiredPermissionForPath("/location")).toBeNull();
  });

  it("does not match a longer path that merely shares the prefix text", () => {
    expect(requiredPermissionForPath("/adminfoo")).toBeNull();
    expect(requiredPermissionForPath("/deliveryX")).toBeNull();
  });
});

describe("permissionsSatisfy", () => {
  it("accepts any admin-tab permission for ANY_ADMIN", () => {
    expect(permissionsSatisfy(["admin.roles"], "ANY_ADMIN")).toBe(true);
    expect(permissionsSatisfy(["module.delivery"], "ANY_ADMIN")).toBe(false);
  });

  it("requires the exact permission otherwise", () => {
    expect(permissionsSatisfy(["module.delivery"], "module.delivery")).toBe(true);
    expect(permissionsSatisfy(["module.counting"], "module.delivery")).toBe(false);
    expect(permissionsSatisfy([], "module.delivery")).toBe(false);
  });
});
