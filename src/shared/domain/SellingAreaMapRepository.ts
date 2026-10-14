import type { SellingAreaMapping, SellingAreaMapInput } from "./SellingAreaMap";

export interface SellingAreaMapRepository {
  /** Full list with resolved names and stale flags — for the admin tab. */
  getAll(): Promise<SellingAreaMapping[]>;

  /** IDs of active selling areas mapped to this feeder — used for pooling. */
  getSellingAreaIdsByFeeder(feederLocationId: number): Promise<number[]>;

  /**
   * Map of selling-area location id → feeder name for active pairs.
   * Used by the location picker guardrail (module = replenishment).
   */
  getSellingAreaFeederNames(): Promise<Map<number, string>>;

  /** Upsert keyed on sellingAreaLocationId (replaces prior feeder if changed). */
  upsert(input: SellingAreaMapInput): Promise<void>;

  remove(sellingAreaLocationId: number): Promise<void>;

  /** All feeder location ids currently in the map — used for FR-3 validation. */
  getFeederIds(): Promise<number[]>;

  /** All selling-area location ids currently in the map — used for FR-3 validation. */
  getSellingAreaIds(): Promise<number[]>;
}
