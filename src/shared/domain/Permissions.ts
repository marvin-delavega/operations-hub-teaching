// Fixed, code-defined permission catalog — the single source of truth for RBAC.
// Admins toggle these per role but can never invent new keys. Edge-safe: no DB imports.

export type PermissionKey =
  // Module access
  | "module.delivery"
  | "module.counting"
  | "module.replenishment"
  | "module.shelfguide"
  | "module.history"
  | "module.invoice"
  | "module.transfer"
  // Supervisor actions
  | "delivery.adjust_lines"
  | "delivery.approve_discrepancies"
  | "counting.adjust_lines"
  | "replenishment.approve"
  // History actions
  | "history.delete_run"
  | "history.delete_draft"
  | "history.edit_draft"
  // Admin tabs
  | "admin.users"
  | "admin.roles"
  | "admin.order_scheduling"
  | "admin.selling_areas"
  | "admin.location_visibility"
  | "admin.delivery_settings"
  | "admin.counting_settings"
  | "admin.sales_rollup"
  | "admin.database_settings"
  | "admin.replenishment_settings"
  | "admin.shelfguide_settings"
  | "admin.general_settings";

export interface PermissionEntry {
  key: PermissionKey;
  label: string;
  // Reserved module permissions are grantable but inert until the module ships.
  reserved?: boolean;
}

export interface PermissionGroup {
  group: string;
  permissions: PermissionEntry[];
}

export const PERMISSION_CATALOG: PermissionGroup[] = [
  {
    group: "Module Access",
    permissions: [
      { key: "module.delivery", label: "Open Delivery" },
      { key: "module.counting", label: "Open Counting" },
      { key: "module.replenishment", label: "Open Replenishment" },
      { key: "module.shelfguide", label: "Open Shelf Guide" },
      { key: "module.history", label: "View History" },
      { key: "module.invoice", label: "Open Invoice", reserved: true },
      { key: "module.transfer", label: "Open Transfer", reserved: true },
    ],
  },
  {
    group: "Supervisor Actions",
    permissions: [
      { key: "delivery.adjust_lines", label: "Adjust/Delete Delivery Lines" },
      { key: "delivery.approve_discrepancies", label: "Approve Delivery Discrepancies & Return Excess" },
      { key: "counting.adjust_lines", label: "Adjust/Delete Counting Lines" },
      { key: "replenishment.approve", label: "Approve Replenishment" },
    ],
  },
  {
    group: "History Actions",
    permissions: [
      { key: "history.delete_run", label: "Delete Replenishment Run" },
      { key: "history.delete_draft", label: "Delete Draft Replenishment Run" },
      { key: "history.edit_draft", label: "Edit Draft Replenishment Quantities" },
    ],
  },
  {
    group: "Admin Tabs",
    permissions: [
      { key: "admin.users", label: "Manage Users" },
      { key: "admin.roles", label: "Manage Roles" },
      { key: "admin.order_scheduling", label: "Order Scheduling" },
      { key: "admin.selling_areas", label: "Selling Areas" },
      { key: "admin.location_visibility", label: "Location Visibility" },
      { key: "admin.delivery_settings", label: "Delivery Settings" },
      { key: "admin.counting_settings", label: "Counting Settings" },
      { key: "admin.sales_rollup", label: "Sales Rollup" },
      { key: "admin.database_settings", label: "Database Settings" },
      { key: "admin.replenishment_settings", label: "Replenishment Settings" },
      { key: "admin.shelfguide_settings", label: "Shelf Guide Settings" },
      { key: "admin.general_settings", label: "General Settings" },
    ],
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_CATALOG.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

const CATALOG_KEY_SET: ReadonlySet<string> = new Set(ALL_PERMISSION_KEYS);

export function isPermissionKey(key: string): key is PermissionKey {
  return CATALOG_KEY_SET.has(key);
}

export function hasAnyAdminTabPermission(perms: readonly string[]): boolean {
  return perms.some((p) => p.startsWith("admin."));
}

// A granted admin-tab or supervisor permission is "sensitive" — its grant triggers a confirm.
export function isSensitivePermission(key: string): boolean {
  return key.startsWith("admin.") || key.startsWith("delivery.") || key.startsWith("counting.") || key.startsWith("replenishment.");
}

// Maps a protected route prefix to the permission it requires. "ANY_ADMIN" means any admin-tab
// permission satisfies the gate; null means the route is session-only (no permission gate).
const MODULE_ROUTE_PERMISSIONS: { prefix: string; permission: PermissionKey | "ANY_ADMIN" }[] = [
  { prefix: "/admin", permission: "ANY_ADMIN" },
  { prefix: "/history", permission: "module.history" },
  { prefix: "/delivery", permission: "module.delivery" },
  { prefix: "/counting", permission: "module.counting" },
  { prefix: "/replenishment", permission: "module.replenishment" },
  { prefix: "/shelfguide", permission: "module.shelfguide" },
  { prefix: "/manufacturer", permission: "module.replenishment" },
  { prefix: "/invoice", permission: "module.invoice" },
  { prefix: "/transfer", permission: "module.transfer" },
];

export function requiredPermissionForPath(pathname: string): PermissionKey | "ANY_ADMIN" | null {
  const match = MODULE_ROUTE_PERMISSIONS.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  return match ? match.permission : null;
}

export function permissionsSatisfy(
  perms: readonly string[],
  need: PermissionKey | "ANY_ADMIN",
): boolean {
  return need === "ANY_ADMIN" ? hasAnyAdminTabPermission(perms) : perms.includes(need);
}
