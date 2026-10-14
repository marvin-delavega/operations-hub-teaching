import { NextResponse } from "next/server";
import { createRefreshItemCacheUseCase } from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";

export async function POST() {
  if (!(await requirePermission("admin.general_settings"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const loadedCount = await createRefreshItemCacheUseCase().execute();
    return NextResponse.json({ loadedCount });
  } catch {
    return NextResponse.json({ error: "Failed to refresh item cache" }, { status: 500 });
  }
}
