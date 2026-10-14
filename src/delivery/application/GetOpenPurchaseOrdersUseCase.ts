import type { OpenPurchaseOrder } from "../domain/Delivery";
import type { DeliveryRepository } from "../domain/DeliveryRepository";

export class GetOpenPurchaseOrdersUseCase {
  constructor(private readonly repository: DeliveryRepository) {}

  execute(): Promise<OpenPurchaseOrder[]> {
    return this.repository.listOpenPurchaseOrders();
  }
}
