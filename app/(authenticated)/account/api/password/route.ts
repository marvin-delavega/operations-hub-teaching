import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/shared/infrastructure/auth";
import { createChangeOwnPasswordUseCase } from "@/container";
import { IncorrectPasswordError, PasswordValidationError } from "@/account/application/PasswordErrors";

export async function PUT(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  try {
    await createChangeOwnPasswordUseCase().execute(userId, currentPassword, newPassword);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof IncorrectPasswordError || error instanceof PasswordValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
