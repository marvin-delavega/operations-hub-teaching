export type ScheduleType = "weekly" | "monthly" | "lead_time";

export type DueStatus = "due_today" | "due_tomorrow" | "other" | "unscheduled";

/**
 * One supplier's raw schedule joined with its live ActiveOne lead time.
 * `scheduleType` is null when no supplier_schedule row exists yet (treated as the
 * default lead-time column, effective only if a positive lead time is present).
 * Dates are ISO `YYYY-MM-DD` strings so comparison and arithmetic stay calendar-based.
 */
export interface SupplierScheduleData {
  supplierId: number;
  name: string;
  scheduleType: ScheduleType | null;
  weekDay: number | null;
  monthDay: number | null;
  lastOrderedAt: string | null;
  leadTimeDays: number | null;
  minOrderValue: number | null;
  minOrderQuantity: number | null;
}

export interface DueInfo {
  nextOrderDate: string | null;
  dueStatus: DueStatus;
}

/**
 * Manila is UTC+8 with no DST, so a fixed offset is exact. Shifting `now` by the
 * offset puts the Manila wall-clock date into the UTC fields of the Date.
 */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function manilaToday(now: Date = new Date()): string {
  return toDateString(new Date(now.getTime() + MANILA_OFFSET_MS));
}

function parse(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function addDays(dateStr: string, amount: number): string {
  return toDateString(new Date(parse(dateStr).getTime() + amount * 86_400_000));
}

function dayOfWeek(dateStr: string): number {
  return parse(dateStr).getUTCDay();
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthlyOccurrence(year: number, month: number, monthDay: number): string {
  const clampedDay = Math.min(monthDay, daysInMonth(year, month));
  const mm = String(month).padStart(2, "0");
  const dd = String(clampedDay).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function effectiveLeadTime(data: SupplierScheduleData): number | null {
  return data.leadTimeDays != null && data.leadTimeDays > 0 ? data.leadTimeDays : null;
}

export function isUnscheduled(data: SupplierScheduleData): boolean {
  if (data.scheduleType === "weekly" && data.weekDay != null) return false;
  if (data.scheduleType === "monthly" && data.monthDay != null) return false;
  return effectiveLeadTime(data) === null;
}

export function computeNextOrderDate(
  data: SupplierScheduleData,
  today: string,
): string | null {
  if (isUnscheduled(data)) return null;

  if (data.scheduleType === "weekly" && data.weekDay != null) {
    const delta = (dayOfWeek(today) - data.weekDay + 7) % 7;
    let candidate = addDays(today, -delta);
    if (data.lastOrderedAt != null && data.lastOrderedAt >= candidate) {
      candidate = addDays(candidate, 7);
    }
    return candidate;
  }

  if (data.scheduleType === "monthly" && data.monthDay != null) {
    let year = Number(today.slice(0, 4));
    let month = Number(today.slice(5, 7));
    let candidate = monthlyOccurrence(year, month, data.monthDay);
    if (candidate > today) {
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
      candidate = monthlyOccurrence(year, month, data.monthDay);
    }
    if (data.lastOrderedAt != null && data.lastOrderedAt >= candidate) {
      month += 1;
      if (month === 13) {
        month = 1;
        year += 1;
      }
      candidate = monthlyOccurrence(year, month, data.monthDay);
    }
    return candidate;
  }

  const anchor = data.lastOrderedAt ?? today;
  return addDays(anchor, effectiveLeadTime(data)!);
}

export function resolveDueInfo(data: SupplierScheduleData, today: string): DueInfo {
  const nextOrderDate = computeNextOrderDate(data, today);
  if (nextOrderDate === null) return { nextOrderDate: null, dueStatus: "unscheduled" };
  if (nextOrderDate <= today) return { nextOrderDate, dueStatus: "due_today" };
  if (nextOrderDate === addDays(today, 1)) return { nextOrderDate, dueStatus: "due_tomorrow" };
  return { nextOrderDate, dueStatus: "other" };
}
