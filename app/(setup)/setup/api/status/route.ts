import { NextResponse } from "next/server";
import { auth } from "@/shared/infrastructure/auth";
import { createGetSetupStatusUseCase } from "@/container";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await createGetSetupStatusUseCase().execute();
  return NextResponse.json(status);
}
