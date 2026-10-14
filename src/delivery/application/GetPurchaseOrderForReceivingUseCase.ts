import type { PurchaseOrderForReceiving } from "../domain/Delivery";
import type { DeliveryRepository } from "../domain/DeliveryRepository";

export class GetPurchaseOrderForReceivingUseCase {
  constructor(private readonly repository: DeliveryRepository) {}

  execute(poId: number): Promise<PurchaseOrderForReceiving | null> {
    return this.repository.getPurchaseOrderForReceiving(poId);
  }
}
