import type { DeliveryHistoryRepository } from "../domain/DeliveryHistoryRepository";
import type { HistoryFilters, Page } from "../domain/HistoryFilters";
import type { DeliverySessionSummary } from "../domain/DeliverySessionSummary";

export class ListDeliveryHistoryUseCase {
  constructor(private readonly repository: DeliveryHistoryRepository) {}

  execute(filters: HistoryFilters): Promise<Page<DeliverySessionSummary>> {
    return this.repository.list(filters);
  }
}
