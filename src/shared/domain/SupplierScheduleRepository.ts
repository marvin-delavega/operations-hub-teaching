import type { ScheduleType, SupplierScheduleData } from "./SupplierSchedule";

export interface SupplierScheduleInput {
  supplierId: number;
  scheduleType: ScheduleType;
  weekDay: number | null;
  monthDay: number | null;
  lastOrderedAt: string | null;
}

export interface SupplierScheduleRepository {
  /** Vendors joined with their schedule + live lead time. All vendors when ids omitted. */
  getData(supplierIds?: number[]): Promise<SupplierScheduleData[]>;
  /** Most recent ActiveOne PO date for a supplier (`YYYY-MM-DD`), or null if none. */
  getMostRecentPoDate(supplierId: number): Promise<string | null>;
  upsert(input: SupplierScheduleInput): Promise<void>;
  /** Set `last_ordered_at` for each supplier, creating a default lead_time row if absent. */
  markOrdered(supplierIds: number[], date: string): Promise<void>;
  /**
   * Persist the optional ₱ and quantity minimums for a supplier. Creates a
   * lead_time row when no schedule row exists yet (FR-4); never touches schedule
   * fields on an existing row.
   */
  setMinimums(
    supplierId: number,
    minOrderValue: number | null,
    minOrderQuantity: number | null,
  ): Promise<void>;
}
