export interface SalesRollupHealth {
  lastRefreshedAt: Date | null;
  minSaleDate: string | null;
  maxSaleDate: string | null;
  totalRows: number;
  distinctItems: number;
}

export interface SalesRollupRepository {
  /**
   * Ensure the rollup has rows for every day in [from, to] for the given location.
   * Any dates with no existing row are computed live from source and persisted.
   * Deliberate exception to CQS: populates a recomputable cache, not business state.
   */
  ensureDaysExist(locationId: number, from: string, to: string): Promise<void>;

  /**
   * Same self-heal as ensureDaysExist, applied across every active location. Used by
   * the cross-location summary recompute so a missed nightly never undercounts the badge.
   */
  ensureDaysExistAllLocations(from: string, to: string): Promise<void>;

  /**
   * Recompute the trailing `windowDays` window (ending today) for all locations.
   * Idempotent upsert — absorbs recent voids/returns/edits.
   */
  refreshTrailingWindow(windowDays: number): Promise<{ rowsAffected: number }>;

  /**
   * Rebuild the full `monthsBack`-month history for all locations, chunked by
   * month × location to avoid long locks on the live ERP database.
   */
  rebuild(monthsBack: number): Promise<{ rowsAffected: number }>;

  /** Health metrics for the admin panel. */
  getHealth(): Promise<SalesRollupHealth>;
}
