import { NextRequest, NextResponse } from "next/server";
import { createGetInvoicesUseCase } from "@/container";

export async function GET(_req: NextRequest) {
  const useCase = createGetInvoicesUseCase();
  return NextResponse.json({ invoices: await useCase.execute() });
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
