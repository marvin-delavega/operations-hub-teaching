import type { ReplenishmentHistoryRepository } from "../domain/ReplenishmentHistoryRepository";
import type { ReplenishmentRunDetail } from "../domain/ReplenishmentRunSummary";

export class GetReplenishmentRunDetailUseCase {
  constructor(private readonly repository: ReplenishmentHistoryRepository) {}

  execute(runId: number): Promise<ReplenishmentRunDetail | null> {
    return this.repository.getById(runId);
  }
}
