import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/shared/infrastructure/auth";
import {
  createGetReplenishmentRunDetailUseCase,
  createDeleteReplenishmentRunUseCase,
  createDeleteDraftReplenishmentRunUseCase,
  createUpdateReplenishmentDraftQuantitiesUseCase,
} from "@/container";
import type { DraftLineQtyUpdate } from "@/history/domain/ReplenishmentHistoryRepository";
import {
  formatAppPoCode,
  getPoCodeDisplaySettings,
} from "@/shared/infrastructure/poCodeDisplay";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId: runIdParam } = await params;
  const runId = Number(runIdParam);
  if (!Number.isInteger(runId) || runId <= 0) {
    return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
  }

  try {
    const run = await createGetReplenishmentRunDetailUseCase().execute(runId);
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { prefix, width } = await getPoCodeDisplaySettings();
    return NextResponse.json({
      ...run,
      pos: run.pos.map((po) => ({
        ...po,
        poCode: formatAppPoCode(po.poCode, prefix, width),
      })),
    });
  } catch (err) {
    console.error("Failed to load run detail:", err);
    return NextResponse.json({ error: "Failed to load run detail" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { runId: runIdParam } = await params;
  const runId = Number(runIdParam);
  if (!Number.isInteger(runId) || runId <= 0) {
    return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
  }

  const perms: readonly string[] = session.user.permissions ?? [];

  try {
    const run = await createGetReplenishmentRunDetailUseCase().execute(runId);
    if (!run) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (run.status === "draft") {
      if (!perms.includes("history.delete_draft")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const result = await createDeleteDraftReplenishmentRunUseCase().execute(runId);
      if (!result.success) {
        return NextResponse.json({ error: result.reason }, { status: 409 });
      }
      return NextResponse.json({ success: true });
    }

    if (!perms.includes("history.delete_run")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const result = await createDeleteReplenishmentRunUseCase().execute(runId);
    if (!result.success) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete run:", err);
    return NextResponse.json({ error: "Failed to delete run" }, { status: 500 });
  }
}

const MAX_DRAFT_QTY = 999999;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const perms: readonly string[] = session.user.permissions ?? [];
  if (!perms.includes("history.edit_draft")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { runId: runIdParam } = await params;
  const runId = Number(runIdParam);
  if (!Number.isInteger(runId) || runId <= 0) {
    return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const rawLines = (body as { lines?: unknown } | null)?.lines;
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return NextResponse.json({ error: "lines must be a non-empty array" }, { status: 400 });
  }

  const linesByLineId = new Map<number, number>();
  for (const raw of rawLines) {
    const lineId = (raw as { lineId?: unknown } | null)?.lineId;
    const finalQty = (raw as { finalQty?: unknown } | null)?.finalQty;
    if (!Number.isInteger(lineId) || (lineId as number) <= 0) {
      return NextResponse.json({ error: "Each line needs a positive integer lineId" }, { status: 400 });
    }
    if (!Number.isInteger(finalQty) || (finalQty as number) < 0 || (finalQty as number) > MAX_DRAFT_QTY) {
      return NextResponse.json(
        { error: `finalQty must be an integer between 0 and ${MAX_DRAFT_QTY}` },
        { status: 400 },
      );
    }
    linesByLineId.set(lineId as number, finalQty as number);
  }
  const lines: DraftLineQtyUpdate[] = [...linesByLineId].map(([lineId, finalQty]) => ({ lineId, finalQty }));

  try {
    const result = await createUpdateReplenishmentDraftQuantitiesUseCase().execute(runId, lines);
    if (!result.success) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to update draft quantities:", err);
    return NextResponse.json({ error: "Failed to update draft quantities" }, { status: 500 });
  }
}
