import type { ShelfGuideRepository } from "../domain/ShelfGuideRepository";

export class GetShelfGuideDefaultLocationUseCase {
  constructor(private readonly repository: ShelfGuideRepository) {}

  async execute(): Promise<number | null> {
    return (
      (await this.repository.getDefaultLocationId()) ??
      (await this.repository.getFirstActiveLocationId())
    );
  }
}
