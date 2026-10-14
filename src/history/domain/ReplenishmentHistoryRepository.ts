import type { ReplenishmentRunSummary, ReplenishmentRunDetail } from "./ReplenishmentRunSummary";
import type { HistoryFilters, Page } from "./HistoryFilters";

export interface CreatedByEntry {
  userId: number;
  userName: string;
}

export interface DeleteReplenishmentRunResult {
  success: boolean;
  reason?: string;
}

export interface DraftLineQtyUpdate {
  lineId: number;
  finalQty: number;
}

export interface UpdateReplenishmentDraftResult {
  success: boolean;
  reason?: string;
}

export interface ReplenishmentHistoryRepository {
  list(filters: HistoryFilters): Promise<Page<ReplenishmentRunSummary>>;
  getById(runId: number): Promise<ReplenishmentRunDetail | null>;
  listCreatedBy(): Promise<CreatedByEntry[]>;
  /** Number of runs with status = 'draft' (the approval worklist size). */
  countPendingDrafts(): Promise<number>;
  delete(runId: number): Promise<DeleteReplenishmentRunResult>;
  approveDraft(runId: number, approvedByUserId: number, approvedByName: string): Promise<void>;
  hardDeleteDraft(runId: number): Promise<DeleteReplenishmentRunResult>;
  updateDraftLineQuantities(runId: number, updates: DraftLineQtyUpdate[]): Promise<UpdateReplenishmentDraftResult>;
}
