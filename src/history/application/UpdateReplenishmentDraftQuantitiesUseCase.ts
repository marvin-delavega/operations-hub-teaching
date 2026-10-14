import type {
  ReplenishmentHistoryRepository,
  DraftLineQtyUpdate,
  UpdateReplenishmentDraftResult,
} from "../domain/ReplenishmentHistoryRepository";

export class UpdateReplenishmentDraftQuantitiesUseCase {
  constructor(private readonly repository: ReplenishmentHistoryRepository) {}

  execute(runId: number, updates: DraftLineQtyUpdate[]): Promise<UpdateReplenishmentDraftResult> {
    return this.repository.updateDraftLineQuantities(runId, updates);
  }
}
