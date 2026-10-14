import type { ReplenishmentSummaryRepository } from "../domain/ReplenishmentSummary";

export class RecomputeReplenishmentSummaryUseCase {
  constructor(private readonly repository: ReplenishmentSummaryRepository) {}

  async execute(): Promise<Date> {
    return this.repository.recompute();
  }
}
