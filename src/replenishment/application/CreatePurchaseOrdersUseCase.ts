import { CreatorNotLinkedError } from "../domain/PurchaseOrder";
import type { PurchaseOrder, PurchaseOrderResult } from "../domain/PurchaseOrder";
import type { PurchaseOrderRepository } from "../domain/PurchaseOrderRepository";

export class CreatePurchaseOrdersUseCase {
  constructor(private readonly repository: PurchaseOrderRepository) {}

  async execute(po: PurchaseOrder): Promise<PurchaseOrderResult[]> {
    // A run may only be saved by a user linked to an ActiveOne employee — mirrors
    // the Delivery receiver gate. Checked before any PO/run write so nothing is
    // committed for an unlinked account.
    const employeeCode = await this.repository.getCreatorEmployeeCode(po.createdByUserId ?? 0);
    if (!employeeCode) throw new CreatorNotLinkedError();

    return this.repository.createAll({ ...po, createdByEmployeeCode: employeeCode });
  }
}
