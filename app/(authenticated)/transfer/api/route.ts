import { NextRequest, NextResponse } from "next/server";
import { createGetTransfersUseCase } from "@/container";

export async function GET(_req: NextRequest) {
  const useCase = createGetTransfersUseCase();
  return NextResponse.json({ transfers: await useCase.execute() });
}

export async function POST(_req: NextRequest) {
  return NextResponse.json({ ok: true });
}

export async function PUT(_req: NextRequest) {
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest) {
  return NextResponse.json({ ok: true });
}
