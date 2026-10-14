import type { SellingAreaMapRepository } from "@/shared/domain/SellingAreaMapRepository";

export class RemoveSellingAreaMappingUseCase {
  constructor(private readonly repository: SellingAreaMapRepository) {}

  async execute(sellingAreaLocationId: number): Promise<void> {
    await this.repository.remove(sellingAreaLocationId);
  }
}
