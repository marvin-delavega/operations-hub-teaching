import { NextRequest, NextResponse } from "next/server";
import { createSaveDbConfigUseCase } from "@/container";
import { bootstrapAllowed } from "@/connect/bootstrapGuard";

// Public (in middleware PUBLIC_PATHS) but self-locking: once the DB is configured and
// reachable this returns 403 and the connection can only be changed from /admin.
export async function POST(req: NextRequest) {
  if (!(await bootstrapAllowed())) {
    return NextResponse.json({ error: "Database is already configured." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const result = await createSaveDbConfigUseCase().execute(body);
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}
