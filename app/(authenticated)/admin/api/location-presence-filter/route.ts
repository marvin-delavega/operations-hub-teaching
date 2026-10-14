import { NextResponse } from "next/server";
import { requirePermission } from "@/admin/api/requirePermission";
import {
  createGetLocationPresenceFiltersUseCase,
  createSetLocationPresenceFilterUseCase,
} from "@/container";
import { ValidationError } from "@/admin/application/SetLocationPresenceFilterUseCase";

export async function GET() {
  if (!(await requirePermission("admin.location_visibility"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const filters = await createGetLocationPresenceFiltersUseCase().execute();
  return NextResponse.json({ filters });
}

export async function PUT(req: Request) {
  if (!(await requirePermission("admin.location_visibility"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { locationId, enabled } = body as Record<string, unknown>;
  if (typeof locationId !== "number" || typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "locationId must be a positive integer and enabled a boolean" },
      { status: 400 },
    );
  }

  try {
    await createSetLocationPresenceFilterUseCase().execute(locationId, enabled);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
