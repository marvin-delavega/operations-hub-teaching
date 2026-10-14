import { NextResponse } from "next/server";
import { createGetMasterlistUseCase } from "@/container";

export async function GET() {
  try {
    const items = await createGetMasterlistUseCase().execute();
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Failed to load item masterlist" }, { status: 500 });
  }
}
