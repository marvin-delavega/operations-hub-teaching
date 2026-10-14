import { NextRequest, NextResponse } from "next/server";
import { createGetShelfGuideDetailUseCase } from "@/container";
import { parseShelfGuideQuery } from "@/shelfguide/api/parseQuery";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> },
) {
  const { supplierId: supplierIdParam } = await params;
  const supplierId = Number(supplierIdParam);
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    return NextResponse.json({ error: "Invalid supplier ID" }, { status: 400 });
  }

  const query = parseShelfGuideQuery(req);
  if (!query.ok) {
    return NextResponse.json({ error: query.error }, { status: 400 });
  }

  try {
    const detail = await createGetShelfGuideDetailUseCase().execute({
      supplierId,
      locationId: query.locationId,
      from: query.from,
      to: query.to,
    });
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) {
    console.error("Failed to load shelf guide detail:", err);
    return NextResponse.json({ error: "Failed to load shelf guide" }, { status: 500 });
  }
}
