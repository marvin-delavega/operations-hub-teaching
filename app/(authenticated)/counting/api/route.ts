import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/shared/infrastructure/auth";
import {
  createGetCountableItemsUseCase,
  createGetCounterGateUseCase,
  createCommitCountUseCase,
} from "@/container";
import { CounterNotLinkedError, EmptyCountError } from "@/counting/domain/Count";
import { PoNumberAssignmentError } from "@/shared/infrastructure/activeonePoMinting";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!session || !Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // locationId scopes the screen (and the POST commit); the cached item index itself is
  // global, so it isn't passed to the items query — but the URL contract is still enforced.
  const locationId = Number(req.nextUrl.searchParams.get("locationId"));
  if (!Number.isInteger(locationId) || locationId <= 0) {
    return NextResponse.json({ error: "locationId must be a positive integer" }, { status: 400 });
  }

  const [items, gate] = await Promise.all([
    createGetCountableItemsUseCase().execute(),
    createGetCounterGateUseCase().execute(userId),
  ]);

  const missingEmployee = gate.countedByContactId === null;
  const missingActiveOneUser = gate.recordedByUserId === null;
  const canSave = !missingEmployee && !missingActiveOneUser;
  const gateReason = canSave
    ? null
    : new CounterNotLinkedError({ employee: missingEmployee, activeOneUser: missingActiveOneUser }).message;

  // Manual line adjust/delete requires the "Adjust/Delete Counting Lines" permission on the
  // logged-in user (no password step-up). Server re-checks nothing extra: adjust is a UI gate.
  const canAdjustLines = (session.user.permissions ?? []).includes("counting.adjust_lines");

  return NextResponse.json({ items, canSave, gateReason, canAdjustLines });
}

interface CommitBody {
  locationId?: unknown;
  note?: unknown;
  continuousScanning?: unknown;
  lines?: unknown;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!session || !Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: CommitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const locationId = Number(body.locationId);
  if (!Number.isInteger(locationId) || locationId <= 0) {
    return NextResponse.json({ error: "locationId must be a positive integer" }, { status: 400 });
  }

  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  const lines = rawLines
    .filter((l): l is { itemId: number; quantity: number } =>
      Number.isInteger(l?.itemId) && l.itemId > 0 &&
      Number.isFinite(l?.quantity) && l.quantity > 0)
    .map((l) => ({ itemId: l.itemId, quantity: Math.trunc(l.quantity) }))
    .filter((l) => l.quantity > 0);

  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  const continuousScanning = body.continuousScanning !== false;

  try {
    const result = await createCommitCountUseCase().execute({
      locationId,
      counterUserId: userId,
      note,
      continuousScanning,
      lines,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CounterNotLinkedError || error instanceof EmptyCountError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof PoNumberAssignmentError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to save count" }, { status: 500 });
  }
}
