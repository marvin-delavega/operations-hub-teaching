import type { ReplenishmentHistoryRepository, DeleteReplenishmentRunResult } from "../domain/ReplenishmentHistoryRepository";

export class DeleteReplenishmentRunUseCase {
  constructor(private readonly repository: ReplenishmentHistoryRepository) {}

  execute(runId: number): Promise<DeleteReplenishmentRunResult> {
    return this.repository.delete(runId);
  }
}
