import { NextRequest, NextResponse } from "next/server";
import { createGetDbConfigUseCase, createSaveDbConfigUseCase } from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";

const FORBIDDEN = NextResponse.json({ error: "Forbidden" }, { status: 403 });

export async function GET() {
  if (!(await requirePermission("admin.database_settings"))) return FORBIDDEN;
  // Never returns the stored password — only host/port/user/database.
  return NextResponse.json(createGetDbConfigUseCase().execute());
}

export async function PUT(req: NextRequest) {
  if (!(await requirePermission("admin.database_settings"))) return FORBIDDEN;
  const body = await req.json().catch(() => ({}));
  const result = await createSaveDbConfigUseCase().execute(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
