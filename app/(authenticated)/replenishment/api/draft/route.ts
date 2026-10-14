import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/shared/infrastructure/auth";
import { createSaveReplenishmentDraftUseCase } from "@/container";
import type { PurchaseOrder } from "@/replenishment/domain/PurchaseOrder";

const MAX_LINE_QUANTITY = 100_000;

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!session || !Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: PurchaseOrder;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.poDate || typeof body.poDate !== "string") {
    return NextResponse.json({ error: "poDate is required" }, { status: 400 });
  }
  if (!Number.isInteger(body.locationId) || body.locationId <= 0) {
    return NextResponse.json({ error: "locationId must be a positive integer" }, { status: 400 });
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "At least one line is required" }, { status: 400 });
  }
  for (const l of body.lines) {
    if (!l.supplierId || typeof l.sku !== "string" || l.sku.trim() === "") {
      return NextResponse.json(
        { error: "Every line needs a supplier and an item code" },
        { status: 400 },
      );
    }
    if (!Number.isInteger(l.quantity) || l.quantity < 0 || l.quantity > MAX_LINE_QUANTITY) {
      return NextResponse.json(
        { error: `Invalid quantity for item ${l.sku}: must be a whole number between 0 and ${MAX_LINE_QUANTITY}` },
        { status: 400 },
      );
    }
    if (
      l.pieceQty != null &&
      (!Number.isInteger(l.pieceQty) || l.pieceQty < 0 || l.pieceQty > MAX_LINE_QUANTITY)
    ) {
      return NextResponse.json(
        { error: `Invalid piece quantity for item ${l.sku}: must be a whole number between 0 and ${MAX_LINE_QUANTITY}` },
        { status: 400 },
      );
    }
    if (
      l.shelfOnHand != null &&
      (!Number.isInteger(l.shelfOnHand) || l.shelfOnHand < 0 || l.shelfOnHand > MAX_LINE_QUANTITY)
    ) {
      return NextResponse.json(
        { error: `Invalid selling-area on-hand for item ${l.sku}: must be a whole number between 0 and ${MAX_LINE_QUANTITY}` },
        { status: 400 },
      );
    }
  }
  const hasValidLine = body.lines.some(
    (l) => l.quantity > 0 || (l.orderedPerPiece === true && Number(l.pieceQty) > 0),
  );
  if (!hasValidLine) {
    return NextResponse.json({ error: "No line has a positive quantity" }, { status: 400 });
  }

  const enrichedBody: PurchaseOrder = {
    ...body,
    createdByUserId: userId,
    createdByName: session.user?.name ?? "Unknown",
    lines: body.lines.map((l) => ({
      ...l,
      orderedPerPiece: l.orderedPerPiece === true,
      pieceQty: Number.isInteger(l.pieceQty) ? l.pieceQty : 0,
      suggestedPieceQty: Number.isFinite(l.suggestedPieceQty) ? l.suggestedPieceQty : 0,
      shelfOnHand:
        l.path === "standard" && typeof l.shelfOnHand === "number" && Number.isInteger(l.shelfOnHand)
          ? l.shelfOnHand
          : null,
    })),
    // belowMinAck is advisory only — pass through when present and valid; never reject.
    belowMinAck: Array.isArray(body.belowMinAck) ? body.belowMinAck : undefined,
  };

  try {
    const result = await createSaveReplenishmentDraftUseCase().execute(enrichedBody);
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Failed to save draft" }, { status: 422 });
    }
    return NextResponse.json({ success: true, runId: result.runId }, { status: 201 });
  } catch (err) {
    console.error("Failed to save draft:", err);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }
}
