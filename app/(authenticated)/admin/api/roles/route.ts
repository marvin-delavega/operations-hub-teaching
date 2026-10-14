import { NextRequest, NextResponse } from "next/server";
import { createGetRolesUseCase, createCreateRoleUseCase } from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";
import { RoleValidationError, RoleNameTakenError } from "@/admin/application/RoleErrors";

export async function GET() {
  if (!(await requirePermission("admin.roles"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const roles = await createGetRolesUseCase().execute();
  return NextResponse.json({ roles });
}

export async function POST(req: NextRequest) {
  if (!(await requirePermission("admin.roles"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  try {
    const id = await createCreateRoleUseCase().execute({
      name: String(body.name ?? ""),
      description: body.description == null ? null : String(body.description),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      permissions: Array.isArray(body.permissions) ? body.permissions.map(String) : [],
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof RoleNameTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof RoleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
