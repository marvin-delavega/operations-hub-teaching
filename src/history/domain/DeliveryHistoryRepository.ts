import type { DeliverySessionSummary, DeliverySessionDetail } from "./DeliverySessionSummary";
import type { HistoryFilters, Page } from "./HistoryFilters";

export interface CreatedByEntry {
  userId: number;
  userName: string;
}

export interface DeliveryHistoryRepository {
  list(filters: HistoryFilters): Promise<Page<DeliverySessionSummary>>;
  getById(deliveryId: number): Promise<DeliverySessionDetail | null>;
  listCreatedBy(): Promise<CreatedByEntry[]>;
}
