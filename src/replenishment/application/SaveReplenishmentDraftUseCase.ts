import type { ReplenishmentDraftRepository, DraftSaveResult } from "../domain/ReplenishmentDraftRepository";
import type { PurchaseOrder } from "../domain/PurchaseOrder";

export class SaveReplenishmentDraftUseCase {
  constructor(private readonly repository: ReplenishmentDraftRepository) {}

  execute(po: PurchaseOrder): Promise<DraftSaveResult> {
    return this.repository.saveDraft(po);
  }
}
