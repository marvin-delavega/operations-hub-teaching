import type { SupplierScheduleRepository } from "@/shared/domain/SupplierScheduleRepository";
import type { ScheduleType } from "@/shared/domain/SupplierSchedule";

export interface UpdateSupplierScheduleInput {
  supplierId: number;
  scheduleType: ScheduleType;
  weekDay: number | null;
  monthDay: number | null;
  /** Admin-provided override. When omitted, an existing anchor is kept or one is prefilled. */
  lastOrderedAt?: string | null;
}

export class UpdateSupplierScheduleUseCase {
  constructor(private readonly repository: SupplierScheduleRepository) {}

  async execute(input: UpdateSupplierScheduleInput): Promise<{ lastOrderedAt: string | null }> {
    const lastOrderedAt = await this.resolveAnchor(input);
    await this.repository.upsert({
      supplierId: input.supplierId,
      scheduleType: input.scheduleType,
      weekDay: input.weekDay,
      monthDay: input.monthDay,
      lastOrderedAt,
    });
    return { lastOrderedAt };
  }

  private async resolveAnchor(input: UpdateSupplierScheduleInput): Promise<string | null> {
    if (input.lastOrderedAt !== undefined) return input.lastOrderedAt;

    const [existing] = await this.repository.getData([input.supplierId]);
    if (existing?.lastOrderedAt != null) return existing.lastOrderedAt;

    // First assignment with no anchor yet — prefill from the most recent ActiveOne PO.
    return this.repository.getMostRecentPoDate(input.supplierId);
  }
}
