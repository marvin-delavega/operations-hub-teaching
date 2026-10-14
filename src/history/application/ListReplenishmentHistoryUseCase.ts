import type { ReplenishmentHistoryRepository } from "../domain/ReplenishmentHistoryRepository";
import type { HistoryFilters, Page } from "../domain/HistoryFilters";
import type { ReplenishmentRunSummary } from "../domain/ReplenishmentRunSummary";

export class ListReplenishmentHistoryUseCase {
  constructor(private readonly repository: ReplenishmentHistoryRepository) {}

  execute(filters: HistoryFilters): Promise<Page<ReplenishmentRunSummary>> {
    return this.repository.list(filters);
  }
}
