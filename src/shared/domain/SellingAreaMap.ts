export interface SellingAreaMapping {
  sellingAreaLocationId: number;
  /** null when the selling-area location has been removed from ActiveOne */
  sellingAreaName: string | null;
  feederLocationId: number;
  /** null when the feeder location has been removed from ActiveOne */
  feederName: string | null;
  /** true when either side is INACTIVE or missing in ActiveOne (FR-20) */
  stale: boolean;
}

export interface SellingAreaMapInput {
  sellingAreaLocationId: number;
  feederLocationId: number;
}
