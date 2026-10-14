import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/shared/infrastructure/auth";
import {
  createGetOpenPurchaseOrdersUseCase,
  createGetPurchaseOrderForReceivingUseCase,
  createCommitDeliveryUseCase,
} from "@/container";
import {
  PurchaseOrderAlreadyReceivedError,
  ReceiverNotLinkedError,
  DiscrepancyApprovalRequiredError,
} from "@/delivery/domain/Delivery";
import { PoNumberAssignmentError } from "@/shared/infrastructure/activeonePoMinting";
import {
  formatAppPoCode,
  getPoCodeDisplaySettings,
} from "@/shared/infrastructure/poCodeDisplay";

// Server-computed capability flags for the client to drive control visibility. The server
// re-checks these permissions on commit, so this is display-gating only.
function capabilitiesFrom(permissions: string[]): { canAdjustLines: boolean; canApproveDiscrepancies: boolean } {
  return {
    canAdjustLines: permissions.includes("delivery.adjust_lines"),
    canApproveDiscrepancies: permissions.includes("delivery.approve_discrepancies"),
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const capabilities = capabilitiesFrom(session?.user?.permissions ?? []);
  const poIdParam = req.nextUrl.searchParams.get("poId");

  if (poIdParam !== null) {
    const poId = Number(poIdParam);
    if (!Number.isInteger(poId) || poId <= 0) {
      return NextResponse.json({ error: "poId must be a positive integer" }, { status: 400 });
    }
    const po = await createGetPurchaseOrderForReceivingUseCase().execute(poId);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not available for receiving" }, { status: 404 });
    }
    const { prefix, width } = await getPoCodeDisplaySettings();
    return NextResponse.json({
      ...po,
      poCode: formatAppPoCode(po.poCode, prefix, width),
      capabilities,
    });
  }

  const purchaseOrders = await createGetOpenPurchaseOrdersUseCase().execute();
  const { prefix, width } = await getPoCodeDisplaySettings();
  return NextResponse.json({
    purchaseOrders: purchaseOrders.map((po) => ({
      ...po,
      poCode: formatAppPoCode(po.poCode, prefix, width),
    })),
    capabilities,
  });
}

interface ReturnExcessBody {
  code?: unknown;
  receivedQuantity?: unknown;
  returnedToQuantity?: unknown;
}

interface CommitBody {
  poId?: unknown;
  lines?: unknown;
  newItems?: unknown;
  continuousScanning?: unknown;
  returnExcessEvents?: unknown;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!session || !Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const canApproveDiscrepancies = (session.user.permissions ?? []).includes("delivery.approve_discrepancies");

  let body: CommitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const poId = Number(body.poId);
  if (!Number.isInteger(poId) || poId <= 0) {
    return NextResponse.json({ error: "poId must be a positive integer" }, { status: 400 });
  }

  const lines = Array.isArray(body.lines) ? body.lines : [];
  const newItems = Array.isArray(body.newItems) ? body.newItems : [];
  const returnExcessRaw = Array.isArray(body.returnExcessEvents) ? body.returnExcessEvents : [];

  const cleanLines = lines
    .filter((l): l is { code: string; receivedQuantity: number } =>
      typeof l?.code === "string" && Number.isFinite(l?.receivedQuantity) && l.receivedQuantity >= 0)
    .map((l) => ({ code: l.code, receivedQuantity: Math.trunc(l.receivedQuantity) }));
  const cleanNewItems = newItems
    .filter((n): n is { code: string; quantity: number } =>
      typeof n?.code === "string" && Number.isFinite(n?.quantity) && n.quantity > 0)
    .map((n) => ({ code: n.code, quantity: Math.trunc(n.quantity) }));
  const cleanReturnExcess = returnExcessRaw
    .filter((r): r is ReturnExcessBody =>
      typeof r?.code === "string" &&
      Number.isFinite(r?.receivedQuantity) &&
      Number.isFinite(r?.returnedToQuantity))
    .map((r) => ({
      code: r.code as string,
      receivedQuantity: Math.trunc(r.receivedQuantity as number),
      returnedToQuantity: Math.trunc(r.returnedToQuantity as number),
    }));

  // Blind mode is intentionally NOT read from the body — the use case resolves it
  // from app_settings so the server-side discrepancy gate can't be bypassed.
  const continuousScanning = body.continuousScanning !== false;

  try {
    const result = await createCommitDeliveryUseCase().execute({
      poId,
      receiverUserId: userId,
      lines: cleanLines,
      newItems: cleanNewItems,
      continuousScanning,
      canApproveDiscrepancies,
      returnExcessEvents: cleanReturnExcess,
    });
    const { prefix, width } = await getPoCodeDisplaySettings();
    return NextResponse.json({
      ...result,
      newPoCode: formatAppPoCode(result.newPoCode, prefix, width),
      closedOriginalPoCode: formatAppPoCode(result.closedOriginalPoCode, prefix, width),
    });
  } catch (error) {
    if (error instanceof ReceiverNotLinkedError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof DiscrepancyApprovalRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof PurchaseOrderAlreadyReceivedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof PoNumberAssignmentError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to save delivery" }, { status: 500 });
  }
}
