import { NextRequest, NextResponse } from "next/server";
import { createGetRoleMembersUseCase, createSetRoleMembersUseCase } from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";
import { RoleValidationError, ProtectedRoleError } from "@/admin/application/RoleErrors";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePermission("admin.roles"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const members = await createGetRoleMembersUseCase().execute(id);
    return NextResponse.json({ members });
  } catch (error) {
    if (error instanceof RoleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePermission("admin.roles"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const userIds = Array.isArray(body.userIds) ? body.userIds.map(String) : [];
  try {
    await createSetRoleMembersUseCase().execute(id, userIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProtectedRoleError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof RoleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
