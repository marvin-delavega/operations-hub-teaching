import type { SellingAreaMapRepository } from "@/shared/domain/SellingAreaMapRepository";
import type { SellingAreaMapping } from "@/shared/domain/SellingAreaMap";

export class GetSellingAreaMappingsUseCase {
  constructor(private readonly repository: SellingAreaMapRepository) {}

  async execute(): Promise<SellingAreaMapping[]> {
    return this.repository.getAll();
  }
}
