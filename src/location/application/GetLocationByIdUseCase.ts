import type { Location } from "../domain/Location";
import type { LocationRepository } from "../domain/LocationRepository";

export class GetLocationByIdUseCase {
  constructor(private readonly repository: LocationRepository) {}

  async execute(id: number): Promise<Location | null> {
    return this.repository.getById(id);
  }
}
