import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/shared/infrastructure/auth";
import { hasAnyAdminTabPermission } from "@/shared/domain/Permissions";
import { createFinishSetupUseCase } from "@/container";

export async function POST() {
  const session = await auth();
  if (!hasAnyAdminTabPermission(session?.user?.permissions ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const completedBy = session.user.name ?? "admin";
  await createFinishSetupUseCase().execute(completedBy);
  revalidateTag("setup-status");
  return NextResponse.json({ ok: true });
}
