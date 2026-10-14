import type { SellingAreaMapRepository } from "@/shared/domain/SellingAreaMapRepository";
import type { SellingAreaMapInput } from "@/shared/domain/SellingAreaMap";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class SaveSellingAreaMappingUseCase {
  constructor(private readonly repository: SellingAreaMapRepository) {}

  async execute(input: SellingAreaMapInput): Promise<void> {
    const { sellingAreaLocationId, feederLocationId } = input;

    if (sellingAreaLocationId === feederLocationId) {
      throw new ValidationError("A location cannot be its own feeder.");
    }

    const [feederIds, sellingAreaIds] = await Promise.all([
      this.repository.getFeederIds(),
      this.repository.getSellingAreaIds(),
    ]);

    if (feederIds.includes(sellingAreaLocationId)) {
      throw new ValidationError(
        "This location is already configured as a feeder. A location cannot be both a feeder and a selling area.",
      );
    }

    if (sellingAreaIds.includes(feederLocationId)) {
      throw new ValidationError(
        "The selected feeder is itself a selling area. Chains are not supported.",
      );
    }

    await this.repository.upsert(input);
  }
}
