import { NextRequest, NextResponse } from "next/server";
import { createGetLocationsUseCase } from "@/container";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const moduleName = searchParams.get("module");
  const showAll = searchParams.get("showAll") === "true";

  if (!moduleName) {
    return NextResponse.json({ error: "module is required" }, { status: 400 });
  }

  const useCase = createGetLocationsUseCase();
  const locations = await useCase.execute(moduleName, showAll);
  return NextResponse.json({ locations });
}
