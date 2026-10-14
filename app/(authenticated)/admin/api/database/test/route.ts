import { NextRequest, NextResponse } from "next/server";
import { createTestDbConnectionUseCase } from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";

export async function POST(req: NextRequest) {
  if (!(await requirePermission("admin.database_settings"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const result = await createTestDbConnectionUseCase().execute(body);
  return NextResponse.json(result);
}
