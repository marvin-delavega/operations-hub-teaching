import { NextRequest, NextResponse } from "next/server";
import { createGetUsersUseCase, createSetLocationVisibilityUseCase } from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";

export async function GET(_req: NextRequest) {
  const useCase = createGetUsersUseCase();
  return NextResponse.json({ users: await useCase.execute() });
}

export async function POST(req: NextRequest) {
  if (!(await requirePermission("admin.replenishment_settings")) && !(await requirePermission("admin.location_visibility"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { module, locationId, hidden } = body as {
    module: unknown;
    locationId: unknown;
    hidden: unknown;
  };

  if (typeof module !== "string" || !module) {
    return NextResponse.json({ error: "module is required" }, { status: 400 });
  }
  if (typeof locationId !== "number" || !Number.isInteger(locationId) || locationId <= 0) {
    return NextResponse.json({ error: "locationId must be a positive integer" }, { status: 400 });
  }
  if (typeof hidden !== "boolean") {
    return NextResponse.json({ error: "hidden must be a boolean" }, { status: 400 });
  }

  await createSetLocationVisibilityUseCase().execute(module, locationId, hidden);
  return NextResponse.json({ ok: true });
}

export async function PUT(_req: NextRequest) {
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest) {
  return NextResponse.json({ ok: true });
}
