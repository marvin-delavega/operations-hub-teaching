import { NextResponse } from "next/server";
import { createGetAppSettingUseCase } from "@/container";

// Session-only settings read for the replenishment screen. Unlike the admin
// settings endpoint, this is NOT gated behind an admin-tab permission (middleware
// already requires `module.replenishment` for any `/replenishment/*` route), so
// staff users get the same admin-configured display settings as admins.
export async function GET() {
  const [
    showAllItemsRaw,
    showIncomingRaw,
    safetyStockModeRaw,
    safetyStockLegacyRaw,
requireApprovalRaw,
  defaultDatePresetRaw,
] = await Promise.all([
    createGetAppSettingUseCase().execute("replenishment_show_all_items"),
    createGetAppSettingUseCase().execute("replenishment_show_incoming"),
    createGetAppSettingUseCase().execute("replenishment_safety_stock_mode"),
    createGetAppSettingUseCase().execute("replenishment_safety_stock"),
    createGetAppSettingUseCase().execute("replenishment_require_approval"),
    createGetAppSettingUseCase().execute("replenishment_default_date_preset"),
  ]);

  const safetyStockMode: "off" | "percentage" | "dynamic" | "days" =
    safetyStockModeRaw === "percentage" || safetyStockModeRaw === "dynamic" || safetyStockModeRaw === "days" || safetyStockModeRaw === "off"
      ? safetyStockModeRaw
      : safetyStockModeRaw === "fixed" || safetyStockLegacyRaw === "on"
        ? "percentage"
        : "off";

  const defaultDatePreset: "week" | "2weeks" | "month" =
    defaultDatePresetRaw === "week" || defaultDatePresetRaw === "2weeks" || defaultDatePresetRaw === "month"
      ? defaultDatePresetRaw
      : "month";

  return NextResponse.json({
    settings: {
      replenishment_show_all_items: showAllItemsRaw === null ? false : showAllItemsRaw === "on",
      replenishment_show_incoming: showIncomingRaw === null ? true : showIncomingRaw === "on",
      replenishment_safety_stock_mode: safetyStockMode,
      replenishment_require_approval: requireApprovalRaw === null ? false : requireApprovalRaw === "on",
      replenishment_default_date_preset: defaultDatePreset,
    },
  });
}
