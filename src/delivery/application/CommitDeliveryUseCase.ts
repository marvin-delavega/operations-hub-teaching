import {
  ReceiverNotLinkedError,
  type DeliveryResult,
  type ReturnExcessEvent,
} from "../domain/Delivery";
import type { DeliveryRepository } from "../domain/DeliveryRepository";
import type { DeliverySettings } from "./DeliverySettings";

export interface CommitDeliveryInput {
  poId: number;
  receiverUserId: number;
  lines: { code: string; receivedQuantity: number }[];
  newItems: { code: string; quantity: number }[];
  continuousScanning: boolean;
  /** From the route: whether the committer holds "Approve Delivery Discrepancies". */
  canApproveDiscrepancies: boolean;
  returnExcessEvents: ReturnExcessEvent[];
}

export class CommitDeliveryUseCase {
  constructor(
    private readonly repository: DeliveryRepository,
    private readonly settings: DeliverySettings,
  ) {}

  async execute(input: CommitDeliveryInput): Promise<DeliveryResult> {
    const employeeCode = await this.repository.getReceiverEmployeeCode(input.receiverUserId);
    if (!employeeCode) throw new ReceiverNotLinkedError();

    // Blind mode is resolved server-side from settings — never from the request —
    // because it decides whether the discrepancy-approval gate applies.
    const blindDelivery = await this.settings.isBlindDeliveryEnabled();

    return this.repository.commit({
      poId: input.poId,
      receiverUserId: input.receiverUserId,
      receiverEmployeeCode: employeeCode,
      lines: input.lines,
      newItems: input.newItems,
      blindDelivery,
      continuousScanning: input.continuousScanning,
      canApproveDiscrepancies: input.canApproveDiscrepancies,
      returnExcessEvents: input.returnExcessEvents,
    });
  }
}
