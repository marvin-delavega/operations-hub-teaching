import type { PurchaseOrder } from "./PurchaseOrder";

export interface DraftSaveResult {
  success: boolean;
  runId?: number;
  error?: string;
}

export interface ReplenishmentDraftRepository {
  saveDraft(po: PurchaseOrder): Promise<DraftSaveResult>;
}
