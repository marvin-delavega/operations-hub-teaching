import { NextResponse } from "next/server";
import { createGetRollupScheduleStatusUseCase } from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";

export async function GET() {
  if (!(await requirePermission("admin.sales_rollup"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = await createGetRollupScheduleStatusUseCase().execute();
  return NextResponse.json(status);
}
