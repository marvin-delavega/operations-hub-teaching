import { NextResponse } from "next/server";
import { createGetSupplierDueStatusesUseCase } from "@/container";

export async function GET() {
  try {
    const dueStatuses = await createGetSupplierDueStatusesUseCase().execute();
    const suppliers = dueStatuses.map((s) => ({
      id: s.supplierId,
      name: s.name,
      nextOrderDate: s.nextOrderDate,
      dueStatus: s.dueStatus,
    }));
    return NextResponse.json({ suppliers });
  } catch {
    return NextResponse.json({ error: "Failed to load suppliers" }, { status: 500 });
  }
}
