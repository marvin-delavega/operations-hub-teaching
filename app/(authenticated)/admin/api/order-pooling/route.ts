import { NextResponse } from "next/server";
import { requirePermission } from "@/admin/api/requirePermission";
import {
  createGetSellingAreaMappingsUseCase,
  createSaveSellingAreaMappingUseCase,
  createRemoveSellingAreaMappingUseCase,
} from "@/container";
import { ValidationError } from "@/admin/application/SaveSellingAreaMappingUseCase";

export async function GET() {
  if (!(await requirePermission("admin.selling_areas"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const mappings = await createGetSellingAreaMappingsUseCase().execute();
  return NextResponse.json({ mappings });
}

export async function POST(req: Request) {
  if (!(await requirePermission("admin.selling_areas"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sellingAreaLocationId, feederLocationId } = body as Record<string, unknown>;
  if (
    typeof sellingAreaLocationId !== "number" ||
    typeof feederLocationId !== "number" ||
    sellingAreaLocationId <= 0 ||
    feederLocationId <= 0
  ) {
    return NextResponse.json(
      { error: "sellingAreaLocationId and feederLocationId must be positive integers" },
      { status: 400 },
    );
  }

  try {
    await createSaveSellingAreaMappingUseCase().execute({
      sellingAreaLocationId,
      feederLocationId,
    });
    const mappings = await createGetSellingAreaMappingsUseCase().execute();
    const saved = mappings.find((m) => m.sellingAreaLocationId === sellingAreaLocationId);
    return NextResponse.json({ mapping: saved ?? null });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(req: Request) {
  if (!(await requirePermission("admin.selling_areas"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sellingAreaLocationId } = body as Record<string, unknown>;
  if (typeof sellingAreaLocationId !== "number" || sellingAreaLocationId <= 0) {
    return NextResponse.json(
      { error: "sellingAreaLocationId must be a positive integer" },
      { status: 400 },
    );
  }

  await createRemoveSellingAreaMappingUseCase().execute(sellingAreaLocationId);
  return NextResponse.json({ success: true });
}
