import { NextRequest, NextResponse } from "next/server";
import { createUpdateRoleUseCase, createDeleteRoleUseCase } from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";
import {
  RoleValidationError,
  RoleNameTakenError,
  RoleInUseError,
  ProtectedRoleError,
} from "@/admin/application/RoleErrors";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePermission("admin.roles"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    await createUpdateRoleUseCase().execute(id, {
      name: String(body.name ?? ""),
      description: body.description == null ? null : String(body.description),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      permissions: Array.isArray(body.permissions) ? body.permissions.map(String) : [],
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProtectedRoleError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof RoleNameTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof RoleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePermission("admin.roles"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await createDeleteRoleUseCase().execute(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProtectedRoleError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof RoleInUseError) {
      return NextResponse.json({ error: error.message, memberCount: error.memberCount }, { status: 409 });
    }
    if (error instanceof RoleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
