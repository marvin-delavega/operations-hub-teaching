import { NextRequest, NextResponse } from "next/server";
import { createTestDbConnectionUseCase } from "@/container";
import { bootstrapAllowed } from "@/connect/bootstrapGuard";

// Public (in middleware PUBLIC_PATHS) but self-locking: only usable while the DB is
// unconfigured/unreachable. Once the live DB works, edits go through /admin.
export async function POST(req: NextRequest) {
  if (!(await bootstrapAllowed())) {
    return NextResponse.json({ error: "Database is already configured." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const result = await createTestDbConnectionUseCase().execute(body);
  return NextResponse.json(result);
}
