import type { ReplenishmentSummaryRepository, ReplenishmentSummaryRow } from "../domain/ReplenishmentSummary";

export class GetReplenishmentSummaryUseCase {
  constructor(private readonly repository: ReplenishmentSummaryRepository) {}

  async execute(): Promise<ReplenishmentSummaryRow[]> {
    return this.repository.getAll();
  }
}
