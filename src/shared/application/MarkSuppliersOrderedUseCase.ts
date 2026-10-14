import type { SupplierScheduleRepository } from "../domain/SupplierScheduleRepository";

/**
 * Advances each supplier's lead-time anchor after a PO is submitted through this app.
 * Creates a default lead_time schedule row for any supplier that has none.
 */
export class MarkSuppliersOrderedUseCase {
  constructor(private readonly repository: SupplierScheduleRepository) {}

  async execute(supplierIds: number[], date: string): Promise<void> {
    const uniqueIds = [...new Set(supplierIds)].filter((id) => Number.isInteger(id) && id > 0);
    await this.repository.markOrdered(uniqueIds, date);
  }
}
