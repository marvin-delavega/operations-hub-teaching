import { NextResponse } from "next/server";
import { createGetReplenishmentSummaryUseCase, createRecomputeReplenishmentSummaryUseCase } from "@/container";

export async function GET() {
  try {
    const rows = await createGetReplenishmentSummaryUseCase().execute();
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ error: "Failed to load replenishment summary" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const computedAt = await createRecomputeReplenishmentSummaryUseCase().execute();
    return NextResponse.json({ computedAt: computedAt.toISOString() });
  } catch {
    return NextResponse.json({ error: "Recompute failed" }, { status: 500 });
  }
}
