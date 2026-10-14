import { NextRequest, NextResponse } from "next/server";
import { createInstallRollupScheduleUseCase } from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";

export async function POST(req: NextRequest) {
  if (!(await requirePermission("admin.sales_rollup"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    trailingWindowDays?: number;
    runTime?: string;
  };
  const { trailingWindowDays, runTime } = body;

  if (
    typeof trailingWindowDays !== "number" ||
    !Number.isInteger(trailingWindowDays) ||
    trailingWindowDays < 1 ||
    trailingWindowDays > 30 ||
    typeof runTime !== "string" ||
    !/^\d{2}:\d{2}$/.test(runTime)
  ) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  const result = await createInstallRollupScheduleUseCase().execute(trailingWindowDays, runTime);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
