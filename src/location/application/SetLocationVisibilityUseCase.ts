import type { LocationVisibilityRepository } from "../domain/LocationVisibilityRepository";

export class SetLocationVisibilityUseCase {
  constructor(private readonly repository: LocationVisibilityRepository) {}

  async execute(module: string, locationId: number, hidden: boolean): Promise<void> {
    return this.repository.setHidden(module, locationId, hidden);
  }
}
