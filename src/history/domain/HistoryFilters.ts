export interface HistoryFilters {
  q?: string;              // Partial PO code search
  from?: string;           // Manila date (YYYY-MM-DD)
  to?: string;             // Manila date (YYYY-MM-DD)
  locationId?: number;
  supplierId?: number;
  createdByUserId?: number;
  approvedOnly?: boolean;  // Delivery only: filter to sessions where an admin approved discrepancies
  status?: "draft" | "active" | "deleted";
  excludeOtherUsersDrafts?: boolean;
  draftOwnerUserId?: number;
  cursor?: string;         // Opaque cursor: "<createdAt>:<id>"
  limit?: number;          // Default 25
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
