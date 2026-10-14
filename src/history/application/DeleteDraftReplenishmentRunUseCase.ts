import type { ReplenishmentHistoryRepository, DeleteReplenishmentRunResult } from "../domain/ReplenishmentHistoryRepository";

export class DeleteDraftReplenishmentRunUseCase {
  constructor(private readonly repository: ReplenishmentHistoryRepository) {}

  execute(runId: number): Promise<DeleteReplenishmentRunResult> {
    return this.repository.hardDeleteDraft(runId);
  }
}
