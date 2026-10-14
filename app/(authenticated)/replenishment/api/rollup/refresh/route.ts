import { NextRequest, NextResponse } from "next/server";
import { createGetAppSettingUseCase, createRefreshSalesRollupUseCase } from "@/container";

/**
 * POST /replenishment/api/rollup/refresh
 *
 * Machine-auth endpoint for the nightly Windows Task Scheduler job.
 * Auth: shared-secret token in the `Authorization: Bearer <token>` header
 *       or `?token=<token>` query param (header preferred).
 * No user session required — this path is in middleware PUBLIC_PATHS.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.ROLLUP_REFRESH_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "ROLLUP_REFRESH_TOKEN is not configured on this server" },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const queryToken = req.nextUrl.searchParams.get("token");
  const provided = bearerToken ?? queryToken;

  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const windowDaysRaw = await createGetAppSettingUseCase().execute("rollup_trailing_window_days");
  const windowDays = Math.max(1, Math.min(30, parseInt(windowDaysRaw ?? "7", 10) || 7));
  const result = await createRefreshSalesRollupUseCase(windowDays).execute();

  return NextResponse.json({
    ok: true,
    windowDays: result.windowDays,
    rowsAffected: result.rowsAffected,
    durationMs: result.durationMs,
  });
}
