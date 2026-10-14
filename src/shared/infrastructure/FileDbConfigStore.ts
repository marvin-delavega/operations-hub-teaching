import type { DbConnectionConfig } from "../domain/DbConnectionConfig";
import type { DbConfigStore } from "../application/DbConfigStore";
import { resolveDbConfig } from "./dbConfig";
import { reconfigurePool } from "./db";

export class FileDbConfigStore implements DbConfigStore {
  get(): DbConnectionConfig | null {
    return resolveDbConfig();
  }

  // reconfigurePool persists the file and hot-swaps the live pool in one step.
  async save(config: DbConnectionConfig): Promise<void> {
    await reconfigurePool(config);
  }
}
