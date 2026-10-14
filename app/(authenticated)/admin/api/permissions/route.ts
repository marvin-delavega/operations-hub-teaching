import { NextResponse } from "next/server";
import { PERMISSION_CATALOG } from "@/shared/domain/Permissions";
import { requirePermission } from "@/admin/api/requirePermission";

export async function GET() {
  if (!(await requirePermission("admin.roles"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ catalog: PERMISSION_CATALOG });
}
