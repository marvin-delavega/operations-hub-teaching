import type { MasterlistItem } from "../domain/Delivery";
import type { ItemMasterCacheRepository } from "../domain/ItemMasterCacheRepository";

export class GetMasterlistUseCase {
  constructor(private readonly repository: ItemMasterCacheRepository) {}

  execute(): Promise<MasterlistItem[]> {
    return this.repository.listAll();
  }
}
