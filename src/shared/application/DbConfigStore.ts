import type { DbConnectionConfig } from "../domain/DbConnectionConfig";

/** Port for reading/persisting the ActiveOne connection config. Save also hot-swaps the pool. */
export interface DbConfigStore {
  get(): DbConnectionConfig | null;
  save(config: DbConnectionConfig): Promise<void>;
}
