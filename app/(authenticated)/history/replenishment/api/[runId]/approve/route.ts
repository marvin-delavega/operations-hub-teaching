import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/shared/infrastructure/auth";
import {
  createApproveReplenishmentDraftUseCase,
  createRecomputeReplenishmentSummaryUseCase,
  createMarkSuppliersOrderedUseCase,
} from "@/container";
import { UnknownSkuError } from "@/replenishment/domain/PurchaseOrder";
import { PoNumberAssignmentError } from "@/shared/infrastructure/activeonePoMinting";
import {
  formatAppPoCode,
  getPoCodeDisplaySettings,
} from "@/shared/infrastructure/poCodeDisplay";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const perms: readonly string[] = session.user.permissions ?? [];
  if (!perms.includes("replenishment.approve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { runId: runIdParam } = await params;
  const runId = Number(runIdParam);
  if (!Number.isInteger(runId) || runId <= 0) {
    return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
  }

  try {
    const result = await createApproveReplenishmentDraftUseCase().execute(runId, {
      userId: Number(session.user.id),
      name: session.user.name ?? "Unknown",
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    const pos = result.pos ?? [];
    const supplierIds = [...new Set(pos.map((p) => Number(p.supplierId)))];
    try {
      const today = new Date();
      const poDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      await createMarkSuppliersOrderedUseCase().execute(supplierIds, poDate);
    } catch { /* non-fatal */ }

    try {
      await createRecomputeReplenishmentSummaryUseCase().execute();
    } catch { /* non-fatal */ }

    const { prefix, width } = await getPoCodeDisplaySettings();
    return NextResponse.json({
      pos: pos.map((p) => ({
        ...p,
        poNumber: formatAppPoCode(p.poNumber, prefix, width),
      })),
    });
  } catch (error) {
    if (error instanceof PoNumberAssignmentError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof UnknownSkuError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Failed to approve draft:", error);
    return NextResponse.json({ error: "Failed to approve draft" }, { status: 500 });
  }
}
