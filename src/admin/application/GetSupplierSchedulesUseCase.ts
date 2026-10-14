import type { SupplierScheduleRepository } from "@/shared/domain/SupplierScheduleRepository";
import type { SupplierScheduleData } from "@/shared/domain/SupplierSchedule";

export class GetSupplierSchedulesUseCase {
  constructor(private readonly repository: SupplierScheduleRepository) {}

  async execute(): Promise<SupplierScheduleData[]> {
    return this.repository.getData();
  }
}
