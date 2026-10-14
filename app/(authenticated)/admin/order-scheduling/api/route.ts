import { NextRequest, NextResponse } from "next/server";
import {
  createGetSupplierSchedulesUseCase,
  createUpdateSupplierScheduleUseCase,
} from "@/container";
import { requirePermission } from "@/admin/api/requirePermission";
import type { ScheduleType } from "@/shared/domain/SupplierSchedule";

const SCHEDULE_TYPES: ScheduleType[] = ["weekly", "monthly", "lead_time"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const schedules = await createGetSupplierSchedulesUseCase().execute();
  return NextResponse.json({ schedules });
}

export async function PUT(req: NextRequest) {
  if (!(await requirePermission("admin.order_scheduling"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const supplierId = body.supplierId;
  if (typeof supplierId !== "number" || !Number.isInteger(supplierId) || supplierId <= 0) {
    return NextResponse.json({ error: "supplierId must be a positive integer" }, { status: 400 });
  }

  const scheduleType = body.scheduleType;
  if (typeof scheduleType !== "string" || !SCHEDULE_TYPES.includes(scheduleType as ScheduleType)) {
    return NextResponse.json({ error: "scheduleType must be weekly, monthly, or lead_time" }, { status: 400 });
  }

  const weekDay = body.weekDay ?? null;
  const monthDay = body.monthDay ?? null;

  if (scheduleType === "weekly") {
    if (typeof weekDay !== "number" || !Number.isInteger(weekDay) || weekDay < 0 || weekDay > 6) {
      return NextResponse.json({ error: "weekDay must be an integer 0–6 for weekly schedules" }, { status: 400 });
    }
    if (monthDay !== null) {
      return NextResponse.json({ error: "monthDay must be absent for weekly schedules" }, { status: 400 });
    }
  } else if (scheduleType === "monthly") {
    if (typeof monthDay !== "number" || !Number.isInteger(monthDay) || monthDay < 1 || monthDay > 31) {
      return NextResponse.json({ error: "monthDay must be an integer 1–31 for monthly schedules" }, { status: 400 });
    }
    if (weekDay !== null) {
      return NextResponse.json({ error: "weekDay must be absent for monthly schedules" }, { status: 400 });
    }
  } else if (weekDay !== null || monthDay !== null) {
    return NextResponse.json({ error: "weekDay and monthDay must be absent for lead_time schedules" }, { status: 400 });
  }

  let lastOrderedAt: string | null | undefined;
  if ("lastOrderedAt" in body) {
    const value = body.lastOrderedAt;
    if (value !== null && (typeof value !== "string" || !DATE_PATTERN.test(value))) {
      return NextResponse.json({ error: "lastOrderedAt must be a YYYY-MM-DD date or null" }, { status: 400 });
    }
    lastOrderedAt = value as string | null;
  }

  const result = await createUpdateSupplierScheduleUseCase().execute({
    supplierId,
    scheduleType: scheduleType as ScheduleType,
    weekDay: scheduleType === "weekly" ? (weekDay as number) : null,
    monthDay: scheduleType === "monthly" ? (monthDay as number) : null,
    lastOrderedAt,
  });

  return NextResponse.json({ success: true, lastOrderedAt: result.lastOrderedAt });
}
