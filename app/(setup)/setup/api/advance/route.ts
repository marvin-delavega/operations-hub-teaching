import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/shared/infrastructure/auth";
import { hasAnyAdminTabPermission } from "@/shared/domain/Permissions";
import { createAdvanceSetupProgressUseCase } from "@/container";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!hasAnyAdminTabPermission(session?.user?.permissions ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const step = typeof body?.step === "number" ? body.step : NaN;
  if (!Number.isInteger(step) || step < 1 || step > 4) {
    return NextResponse.json({ error: "step must be an integer between 1 and 4" }, { status: 400 });
  }

  await createAdvanceSetupProgressUseCase().execute(step);
  return NextResponse.json({ ok: true });
}
