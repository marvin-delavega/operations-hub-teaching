import type { ReplenishmentHistoryRepository } from "../domain/ReplenishmentHistoryRepository";

export class CountPendingReplenishmentDraftsUseCase {
  constructor(private readonly repository: ReplenishmentHistoryRepository) {}

  execute(): Promise<number> {
    return this.repository.countPendingDrafts();
  }
}
