import type { ReplenishmentHistoryRepository } from "@/history/domain/ReplenishmentHistoryRepository";
import type { PurchaseOrderRepository } from "../domain/PurchaseOrderRepository";
import type { PurchaseOrderResult } from "../domain/PurchaseOrder";

export interface ApproveDraftResult {
  success: boolean;
  pos?: PurchaseOrderResult[];
  error?: string;
}

export class ApproveReplenishmentDraftUseCase {
  constructor(
    private readonly historyRepo: ReplenishmentHistoryRepository,
    private readonly poRepo: PurchaseOrderRepository,
  ) {}

  async execute(runId: number, approver: { userId: number; name: string }): Promise<ApproveDraftResult> {
    const draft = await this.historyRepo.getById(runId);
    if (!draft) return { success: false, error: "Draft not found." };
    if (draft.status !== "draft") return { success: false, error: "Run is not a draft." };

    const pos = await this.poRepo.createPOsFromDraft(draft);

    await this.historyRepo.approveDraft(runId, approver.userId, approver.name);

    return { success: true, pos };
  }
}
