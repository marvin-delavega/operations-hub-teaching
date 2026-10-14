import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/shared/infrastructure/auth";
import {
  createCreatePurchaseOrdersUseCase,
  createRecomputeReplenishmentSummaryUseCase,
  createMarkSuppliersOrderedUseCase,
} from "@/container";
import type { PurchaseOrder } from "@/replenishment/domain/PurchaseOrder";
import { UnknownSkuError, CreatorNotLinkedError } from "@/replenishment/domain/PurchaseOrder";
import { PoNumberAssignmentError } from "@/shared/infrastructure/activeonePoMinting";
import {
  formatAppPoCode,
  getPoCodeDisplaySettings,
} from "@/shared/infrastructure/poCodeDisplay";

// Sanity ceiling for a single line's quantity (purchase units). Far above any
// legitimate order; blocks fat-finger/corrupt payloads from reaching ActiveOne.
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
  // Validate every line, not just "at least one good one" — a bad line would
  // otherwise be written into ActiveOne verbatim. Zero-qty lines are legal
  // (review screen zeroes a line to drop it); negatives/fractions are not.
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
    // pieceQty (remainder pieces for a split line) is optional; validate when present.
    if (
      l.pieceQty != null &&
      (!Number.isInteger(l.pieceQty) || l.pieceQty < 0 || l.pieceQty > MAX_LINE_QUANTITY)
    ) {
      return NextResponse.json(
        { error: `Invalid piece quantity for item ${l.sku}: must be a whole number between 0 and ${MAX_LINE_QUANTITY}` },
        { status: 400 },
      );
    }
    // shelfOnHand (manual selling-area count) is optional; validate when present.
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
  // A line is orderable if it has cases OR (as a split) a positive piece remainder.
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
      // Coerce to strict types so a tampered payload never reaches the repo as an
      // unexpected shape (FR-13).
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

  let pos: Awaited<ReturnType<ReturnType<typeof createCreatePurchaseOrdersUseCase>["execute"]>>;
  try {
    pos = await createCreatePurchaseOrdersUseCase().execute(enrichedBody);
  } catch (error) {
    if (error instanceof CreatorNotLinkedError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof PoNumberAssignmentError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof UnknownSkuError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Failed to create purchase orders" }, { status: 500 });
  }

  try {
    // Advance the order-schedule anchor only for suppliers that actually got a
    // PO — a supplier whose lines were all zero-qty must keep its due date.
    const supplierIds = [...new Set(pos.map((p) => Number(p.supplierId)))];
    await createMarkSuppliersOrderedUseCase().execute(supplierIds, body.poDate);
  } catch {
    // POs are committed. A failure to advance the order-schedule anchor only
    // affects future due-date signals — it does not undo the submitted orders.
  }

  try {
    await createRecomputeReplenishmentSummaryUseCase().execute();
  } catch {
    // POs are committed. Recompute failure leaves the summary stale until the
    // next manual refresh — it does not undo the submitted orders.
  }

  // Display-only formatting: pad app PO codes to the configured width for the
  // client (generated codes stay minimal); native/non-prefix codes pass through.
  const { prefix, width } = await getPoCodeDisplaySettings();
  const formattedPos = pos.map((p) => ({
    ...p,
    poNumber: formatAppPoCode(p.poNumber, prefix, width),
  }));

  return NextResponse.json({ pos: formattedPos });
}
