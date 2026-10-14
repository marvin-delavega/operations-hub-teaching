import type { DeliveryHistoryRepository } from "../domain/DeliveryHistoryRepository";
import type { DeliverySessionDetail } from "../domain/DeliverySessionSummary";

export class GetDeliverySessionDetailUseCase {
  constructor(private readonly repository: DeliveryHistoryRepository) {}

  execute(deliveryId: number): Promise<DeliverySessionDetail | null> {
    return this.repository.getById(deliveryId);
  }
}
