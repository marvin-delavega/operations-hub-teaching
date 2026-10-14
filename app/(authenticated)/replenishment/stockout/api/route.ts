import { NextRequest, NextResponse } from "next/server";
import {
  createGetStockoutCandidatesUseCase,
  createGetLocationByIdUseCase,
} from "@/container";
import { parseManufacturerTokens } from "@/manufacturer/domain/manufacturerTokens";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationIdParam = searchParams.get("locationId");
  const supplierIdsParam = searchParams.get("supplierIds");

  if (!locationIdParam) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }
  if (!supplierIdsParam) {
    return NextResponse.json({ error: "supplierIds is required" }, { status: 400 });
  }

  const locationId = Number(locationIdParam);
  if (!Number.isInteger(locationId) || locationId <= 0) {
    return NextResponse.json({ error: "locationId must be a positive integer" }, { status: 400 });
  }

  const supplierIds = supplierIdsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (supplierIds.length === 0) {
    return NextResponse.json({ error: "supplierIds must contain at least one valid ID" }, { status: 400 });
  }

  const manufacturerPairs = parseManufacturerTokens(searchParams.get("manufacturerIds")) ?? undefined;

  const location = await createGetLocationByIdUseCase().execute(locationId);
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const groups = await createGetStockoutCandidatesUseCase().execute(locationId, supplierIds, manufacturerPairs);

  return NextResponse.json({ groups, locationName: location.name });
}
