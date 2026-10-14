import type { SupplierScheduleRepository } from "@/shared/domain/SupplierScheduleRepository";

export interface SetSupplierMinimumInput {
  supplierId: number;
  minOrderValue: number | null;
  minOrderQuantity: number | null;
}

export class SetSupplierMinimumUseCase {
  constructor(private readonly repository: SupplierScheduleRepository) {}

  async execute(input: SetSupplierMinimumInput): Promise<void> {
    await this.repository.setMinimums(
      input.supplierId,
      input.minOrderValue,
      input.minOrderQuantity,
    );
  }
}
