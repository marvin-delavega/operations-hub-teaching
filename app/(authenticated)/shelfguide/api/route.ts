import { NextRequest, NextResponse } from "next/server";
import { createGetShelfGuideOverviewUseCase } from "@/container";
import { parseShelfGuideQuery } from "@/shelfguide/api/parseQuery";

export async function GET(req: NextRequest) {
  const query = parseShelfGuideQuery(req);
  if (!query.ok) {
    return NextResponse.json({ error: query.error }, { status: 400 });
  }

  try {
    const overview = await createGetShelfGuideOverviewUseCase().execute({
      locationId: query.locationId,
      from: query.from,
      to: query.to,
    });
    return NextResponse.json(overview);
  } catch (err) {
    console.error("Failed to load shelf guide overview:", err);
    return NextResponse.json({ error: "Failed to load shelf guide" }, { status: 500 });
  }
}
