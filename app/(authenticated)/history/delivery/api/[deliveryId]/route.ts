import { NextRequest, NextResponse } from "next/server";
import { createGetDeliverySessionDetailUseCase } from "@/container";
import {
  formatAppPoCode,
  getPoCodeDisplaySettings,
} from "@/shared/infrastructure/poCodeDisplay";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ deliveryId: string }> },
) {
  const { deliveryId: deliveryIdParam } = await params;
  const deliveryId = Number(deliveryIdParam);
  if (!Number.isInteger(deliveryId) || deliveryId <= 0) {
    return NextResponse.json({ error: "Invalid delivery ID" }, { status: 400 });
  }

  try {
    const session = await createGetDeliverySessionDetailUseCase().execute(deliveryId);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { prefix, width } = await getPoCodeDisplaySettings();
    return NextResponse.json({
      ...session,
      originalPoCode:
        session.originalPoCode === null ? null : formatAppPoCode(session.originalPoCode, prefix, width),
      newPoCode: formatAppPoCode(session.newPoCode, prefix, width),
    });
  } catch (error) {
    console.error("Failed to load delivery detail", error);
    return NextResponse.json({ error: "Failed to load delivery detail" }, { status: 500 });
  }
}
