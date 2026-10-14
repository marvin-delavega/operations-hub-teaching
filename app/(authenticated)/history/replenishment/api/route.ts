import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/shared/infrastructure/auth";
import {
  createListReplenishmentHistoryUseCase,
} from "@/container";
import type { HistoryFilters } from "@/history/domain/HistoryFilters";
import { hasAnyAdminTabPermission } from "@/shared/domain/Permissions";
import {
  formatAppPoCode,
  getPoCodeDisplaySettings,
} from "@/shared/infrastructure/poCodeDisplay";

export async function GET(req: NextRequest) {
  const session = await auth();
  const sp = req.nextUrl.searchParams;
  const perms: readonly string[] = session?.user?.permissions ?? [];
  const isAdmin = hasAnyAdminTabPermission(perms);
  const currentUserId = Number(session?.user?.id);

  const filters: HistoryFilters = {
    q: sp.get("q") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    locationId: sp.has("locationId") ? Number(sp.get("locationId")) : undefined,
    supplierId: sp.has("supplierId") ? Number(sp.get("supplierId")) : undefined,
    createdByUserId: sp.has("createdBy") ? Number(sp.get("createdBy")) : undefined,
    status: sp.has("status") ? (sp.get("status") as HistoryFilters["status"]) : undefined,
    cursor: sp.get("cursor") ?? undefined,
    limit: sp.has("limit") ? Number(sp.get("limit")) : undefined,
  };

  if (!isAdmin && Number.isInteger(currentUserId) && currentUserId > 0) {
    filters.excludeOtherUsersDrafts = true;
    filters.draftOwnerUserId = currentUserId;
  }

  try {
    const page = await createListReplenishmentHistoryUseCase().execute(filters);
    const { prefix, width } = await getPoCodeDisplaySettings();
    return NextResponse.json({
      ...page,
      items: page.items.map((run) => ({
        ...run,
        poCodes: run.poCodes.map((code) => formatAppPoCode(code, prefix, width)),
      })),
    });
  } catch (err) {
    console.error("Failed to load replenishment history:", err);
    return NextResponse.json({ error: "Failed to load replenishment history" }, { status: 500 });
  }
}
