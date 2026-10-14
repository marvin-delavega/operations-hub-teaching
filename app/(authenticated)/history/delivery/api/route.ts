import { NextRequest, NextResponse } from "next/server";
import { createListDeliveryHistoryUseCase } from "@/container";
import type { HistoryFilters } from "@/history/domain/HistoryFilters";
import {
  formatAppPoCode,
  getPoCodeDisplaySettings,
} from "@/shared/infrastructure/poCodeDisplay";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const filters: HistoryFilters = {
    q: sp.get("q") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    locationId: sp.has("locationId") ? Number(sp.get("locationId")) : undefined,
    supplierId: sp.has("supplierId") ? Number(sp.get("supplierId")) : undefined,
    createdByUserId: sp.has("createdBy") ? Number(sp.get("createdBy")) : undefined,
    approvedOnly: sp.get("approvedOnly") === "1",
    cursor: sp.get("cursor") ?? undefined,
    limit: sp.has("limit") ? Number(sp.get("limit")) : undefined,
  };

  try {
    const page = await createListDeliveryHistoryUseCase().execute(filters);
    const { prefix, width } = await getPoCodeDisplaySettings();
    return NextResponse.json({
      ...page,
      items: page.items.map((s) => ({
        ...s,
        originalPoCode:
          s.originalPoCode === null ? null : formatAppPoCode(s.originalPoCode, prefix, width),
        newPoCode: formatAppPoCode(s.newPoCode, prefix, width),
      })),
    });
  } catch (error) {
    console.error("Failed to load delivery history", error);
    return NextResponse.json({ error: "Failed to load delivery history" }, { status: 500 });
  }
}
