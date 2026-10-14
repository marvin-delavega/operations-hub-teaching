import { NextRequest, NextResponse } from "next/server";
import { createSearchEmployeesUseCase } from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";

export async function GET(req: NextRequest) {
  if (!(await requirePermission("admin.users"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const query = req.nextUrl.searchParams.get("q") ?? "";
  const employees = await createSearchEmployeesUseCase().execute(query);
  return NextResponse.json({ employees });
}
