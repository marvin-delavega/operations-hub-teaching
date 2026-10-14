import { NextResponse } from "next/server";
import { createGetShelfGuideDefaultLocationUseCase } from "@/container";

export async function GET() {
  try {
    const locationId = await createGetShelfGuideDefaultLocationUseCase().execute();
    return NextResponse.json({ locationId });
  } catch (err) {
    console.error("Failed to load shelf guide default location:", err);
    return NextResponse.json({ error: "Failed to load default location" }, { status: 500 });
  }
}
