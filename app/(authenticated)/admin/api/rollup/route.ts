import { NextRequest, NextResponse } from "next/server";
import {
  createGetAppSettingUseCase,
  createGetSalesRollupHealthUseCase,
  createRefreshSalesRollupUseCase,
  createRebuildSalesRollupUseCase,
} from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";

/** GET /admin/api/rollup — read-only health metrics for the admin panel. */
export async function GET() {
  if (!(await requirePermission("admin.sales_rollup"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const health = await createGetSalesRollupHealthUseCase().execute();
  return NextResponse.json({ health });
}

/**
 * POST /admin/api/rollup — trigger a manual refresh or full rebuild.
 * Body: { action: "refresh" | "rebuild" }
 */
export async function POST(req: NextRequest) {
  if (!(await requirePermission("admin.sales_rollup"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { action?: string };
  const { action } = body;

  if (action === "refresh") {
    const windowDaysRaw = await createGetAppSettingUseCase().execute("rollup_trailing_window_days");
    const windowDays = Math.max(1, Math.min(30, parseInt(windowDaysRaw ?? "7", 10) || 7));
    const result = await createRefreshSalesRollupUseCase(windowDays).execute();
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "rebuild") {
    const result = await createRebuildSalesRollupUseCase().execute();
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json(
    { error: "action must be 'refresh' or 'rebuild'" },
    { status: 400 },
  );
}
