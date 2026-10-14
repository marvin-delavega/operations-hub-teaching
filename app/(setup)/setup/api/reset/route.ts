import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/shared/infrastructure/auth";
import { hasAnyAdminTabPermission } from "@/shared/domain/Permissions";
import { createResetSetupUseCase } from "@/container";
import { IncorrectPasswordError } from "@/setup/application/ResetSetupUseCase";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!hasAnyAdminTabPermission(session?.user?.permissions ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ error: "password is required" }, { status: 400 });
  }

  const userId = session.user.id;
  const resetBy = session.user.name ?? "admin";

  try {
    await createResetSetupUseCase().execute(userId, password, resetBy);
    revalidateTag("setup-status");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof IncorrectPasswordError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
