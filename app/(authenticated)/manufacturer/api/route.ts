import { NextRequest, NextResponse } from "next/server";
import { createGetManufacturersForSuppliersUseCase } from "@/container";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const supplierIdsParam = searchParams.get("supplierIds");

  if (!supplierIdsParam) {
    return NextResponse.json({ error: "supplierIds is required" }, { status: 400 });
  }

  const supplierIds = supplierIdsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (supplierIds.length === 0) {
    return NextResponse.json({ error: "supplierIds must contain at least one valid ID" }, { status: 400 });
  }

  try {
    const suppliers = await createGetManufacturersForSuppliersUseCase().execute(supplierIds);
    return NextResponse.json({ suppliers });
  } catch {
    return NextResponse.json({ error: "Failed to load manufacturers" }, { status: 500 });
  }
}
