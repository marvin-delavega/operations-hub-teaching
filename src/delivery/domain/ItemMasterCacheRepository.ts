import type { MasterlistItem } from "./Delivery";

export interface ItemMasterCacheRepository {
  /** Re-pull the ActiveOne masterlist into the cache; returns the loaded item count. */
  refresh(): Promise<number>;
  listAll(): Promise<MasterlistItem[]>;
}
