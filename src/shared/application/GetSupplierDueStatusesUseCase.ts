import type { SupplierScheduleRepository } from "../domain/SupplierScheduleRepository";
import { manilaToday, resolveDueInfo, type DueStatus } from "../domain/SupplierSchedule";

export interface SupplierDueStatus {
  supplierId: number;
  name: string;
  nextOrderDate: string | null;
  dueStatus: DueStatus;
  minOrderValue: number | null;
  minOrderQuantity: number | null;
}

/**
 * The single source of truth for next-order-date and due-status across the app.
 * /supplier/api, /replenishment/api, and the landing badge all resolve due status
 * through here — never by reimplementing the date math per route.
 */
export class GetSupplierDueStatusesUseCase {
  constructor(private readonly repository: SupplierScheduleRepository) {}

  async execute(supplierIds?: number[]): Promise<SupplierDueStatus[]> {
    const today = manilaToday();
    const rows = await this.repository.getData(supplierIds);
    return rows.map((data) => {
      const { nextOrderDate, dueStatus } = resolveDueInfo(data, today);
      return {
        supplierId: data.supplierId,
        name: data.name,
        nextOrderDate,
        dueStatus,
        minOrderValue: data.minOrderValue,
        minOrderQuantity: data.minOrderQuantity,
      };
    });
  }
}

export type { DueStatus };
