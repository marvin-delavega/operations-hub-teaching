import { NextRequest, NextResponse } from "next/server";
import { createSearchActiveOneUsersUseCase } from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";

export async function GET(req: NextRequest) {
  if (!(await requirePermission("admin.users"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const query = req.nextUrl.searchParams.get("q") ?? "";
  const users = await createSearchActiveOneUsersUseCase().execute(query);
  return NextResponse.json({ users });
}
