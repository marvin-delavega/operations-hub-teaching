import { NextRequest, NextResponse } from "next/server";
import {
  createGetReplenishmentGroupsUseCase,
  createGetLocationByIdUseCase,
  createGetSupplierDueStatusesUseCase,
  createGetAppSettingUseCase,
} from "@/container";
import { parseManufacturerTokens } from "@/manufacturer/domain/manufacturerTokens";
import { presenceFilterSettingKey } from "@/shared/domain/PresenceFilterSetting";
import type { SafetyStockMode } from "@/replenishment/domain/ReplenishmentRepository";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const locationIdParam = searchParams.get("locationId");
  const supplierIdsParam = searchParams.get("supplierIds");
  const showAllItems = searchParams.get("showAllItems") === "true";
  const worksheet = searchParams.get("worksheet") === "true";

  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  if (!locationIdParam) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  const locationId = Number(locationIdParam);
  if (!Number.isInteger(locationId) || locationId <= 0) {
    return NextResponse.json({ error: "locationId must be a positive integer" }, { status: 400 });
  }

  if (!supplierIdsParam) {
    return NextResponse.json({ error: "supplierIds is required" }, { status: 400 });
  }

  const supplierIds = supplierIdsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (supplierIds.length === 0) {
    return NextResponse.json({ error: "supplierIds must be one or more positive integers" }, { status: 400 });
  }

  const manufacturerPairs = parseManufacturerTokens(searchParams.get("manufacturerIds")) ?? undefined;

  const location = await createGetLocationByIdUseCase().execute(locationId);
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const modeRaw = await createGetAppSettingUseCase().execute("replenishment_safety_stock_mode");
  const legacySafetyStock = await createGetAppSettingUseCase().execute("replenishment_safety_stock");
  const mode: SafetyStockMode =
    modeRaw === "percentage" || modeRaw === "dynamic" || modeRaw === "days"
      ? modeRaw
      : modeRaw === "off"
        ? "off"
        : modeRaw === "fixed" || legacySafetyStock === "on"
          ? "percentage"
          : "off";
  const level = Number(await createGetAppSettingUseCase().execute("replenishment_safety_stock_level")) || 90;
  const maxLevel = Number(await createGetAppSettingUseCase().execute("replenishment_safety_stock_max_level")) || 99;
  const daysRaw = Number(await createGetAppSettingUseCase().execute("replenishment_safety_stock_days"));
  const days = Number.isInteger(daysRaw) && daysRaw >= 1 ? Math.min(30, daysRaw) : 7;
  const safetyStock = { mode, level, maxLevel, days };

  const includeIncoming = (await createGetAppSettingUseCase().execute("replenishment_show_incoming")) !== "off";

  const requireItemPresence =
    (await createGetAppSettingUseCase().execute(presenceFilterSettingKey(locationId))) === "on";

  const groups = await createGetReplenishmentGroupsUseCase().execute(
    new Date(from),
    new Date(to),
    locationId,
    supplierIds,
    showAllItems,
    manufacturerPairs,
    worksheet,
    safetyStock,
    includeIncoming,
    requireItemPresence,
  );

  const dueStatuses = await createGetSupplierDueStatusesUseCase().execute(supplierIds);
  const scheduleBySupplier = new Map(dueStatuses.map((d) => [String(d.supplierId), d]));
  const groupsWithDue = groups.map((group) => {
    const schedule = scheduleBySupplier.get(group.supplierId);
    return {
      ...group,
      dueStatus: schedule?.dueStatus ?? "unscheduled",
      minOrderValue: schedule?.minOrderValue ?? null,
      minOrderQuantity: schedule?.minOrderQuantity ?? null,
    };
  });

  return NextResponse.json({ groups: groupsWithDue, locationName: location.name });
}