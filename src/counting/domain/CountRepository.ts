import type { CountableItem, CountCommit, CounterGate, CountResult } from "./Count";

export interface CountRepository {
  /**
   * Scannable items for the client index (client resolves scans locally), read from the
   * shared item-master cache. Global (not location-scoped): the item set is location-agnostic
   * and the display unit is the cached global purchase unit; the authoritative per-location
   * unit is resolved live at commit (FR-9).
   */
  getCountableItems(): Promise<CountableItem[]>;
  /** The counter's resolved ActiveOne identities + names for the save gate. */
  getCounterGate(userId: number): Promise<CounterGate>;
  /**
   * Atomically write the ActiveOne inventory_count document and our stock_count mirror.
   * Units/factors are resolved server-side per line (FR-9). Each Save mints a fresh,
   * independent document — no supersede, no optimistic-concurrency re-read (FR-19).
   */
  commit(
    input: CountCommit & {
      countedByContactId: number;
      recordedByUserId: number;
      counterName: string | null;
      recorderName: string | null;
    },
  ): Promise<CountResult>;
}
