import type { PurchaseOrder, PurchaseOrderResult } from "./PurchaseOrder";
import type { ReplenishmentRunDetail } from "@/history/domain/ReplenishmentRunSummary";

export interface PurchaseOrderRepository {
  createAll(po: PurchaseOrder): Promise<PurchaseOrderResult[]>;
  /** The submitting user's linked ActiveOne employee code, or null if unlinked/inactive. */
  getCreatorEmployeeCode(userId: number): Promise<string | null>;
  createPOsFromDraft(draft: ReplenishmentRunDetail): Promise<PurchaseOrderResult[]>;
}
