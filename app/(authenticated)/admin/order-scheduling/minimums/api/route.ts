import { NextRequest, NextResponse } from "next/server";
import { createSetSupplierMinimumUseCase } from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";

export async function PUT(req: NextRequest) {
  if (!(await requirePermission("admin.order_scheduling"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const supplierId = body.supplierId;
  if (typeof supplierId !== "number" || !Number.isInteger(supplierId) || supplierId <= 0) {
    return NextResponse.json({ error: "supplierId must be a positive integer" }, { status: 400 });
  }

  // Validate minOrderValue: null (clear) or non-negative number with ≤ 2 decimals.
  let minOrderValue: number | null = null;
  if (body.minOrderValue !== null && body.minOrderValue !== undefined && body.minOrderValue !== "") {
    const raw = Number(body.minOrderValue);
    if (!Number.isFinite(raw) || raw < 0) {
      return NextResponse.json(
        { error: "minOrderValue must be a non-negative number or null" },
        { status: 400 },
      );
    }
    if (Math.round(raw * 100) / 100 !== raw) {
      return NextResponse.json(
        { error: "minOrderValue must have at most 2 decimal places" },
        { status: 400 },
      );
    }
    minOrderValue = raw;
  }

  // Validate minOrderQuantity: null (clear) or non-negative whole number.
  let minOrderQuantity: number | null = null;
  if (body.minOrderQuantity !== null && body.minOrderQuantity !== undefined && body.minOrderQuantity !== "") {
    const raw = Number(body.minOrderQuantity);
    if (!Number.isInteger(raw) || raw < 0) {
      return NextResponse.json(
        { error: "minOrderQuantity must be a non-negative integer or null" },
        { status: 400 },
      );
    }
    minOrderQuantity = raw;
  }

  await createSetSupplierMinimumUseCase().execute({ supplierId, minOrderValue, minOrderQuantity });
  return NextResponse.json({ success: true });
}
