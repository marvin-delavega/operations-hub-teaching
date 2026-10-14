import { NextRequest, NextResponse } from "next/server";
import { createUpdateUserUseCase } from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";
import {
  UserValidationError,
  UsernameTakenError,
  ProtectedUserError,
} from "@/admin/application/UserErrors";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePermission("admin.users"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    await createUpdateUserUseCase().execute(id, {
      name: String(body.name ?? ""),
      username: String(body.username ?? ""),
      roleIds: Array.isArray(body.roleIds) ? body.roleIds.map(String) : [],
      employeeCode: body.employeeCode == null ? null : String(body.employeeCode),
      activeOneUserId: body.activeOneUserId == null ? null : String(body.activeOneUserId),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProtectedUserError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof UsernameTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof UserValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
