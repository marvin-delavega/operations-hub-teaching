import type { ItemMasterCacheRepository } from "../domain/ItemMasterCacheRepository";

export class RefreshItemCacheUseCase {
  constructor(private readonly repository: ItemMasterCacheRepository) {}

  execute(): Promise<number> {
    return this.repository.refresh();
  }
}
