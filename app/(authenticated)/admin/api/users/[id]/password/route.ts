import { NextRequest, NextResponse } from "next/server";
import { createResetUserPasswordUseCase } from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";
import { UserValidationError, ProtectedUserError } from "@/admin/application/UserErrors";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePermission("admin.users"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    await createResetUserPasswordUseCase().execute(id, String(body.password ?? ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProtectedUserError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof UserValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
