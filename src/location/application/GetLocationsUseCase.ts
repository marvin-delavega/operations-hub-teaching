import type { Location } from "../domain/Location";
import type { LocationRepository } from "../domain/LocationRepository";
import type { SellingAreaMapRepository } from "@/shared/domain/SellingAreaMapRepository";

export class GetLocationsUseCase {
  constructor(
    private readonly repository: LocationRepository,
    private readonly sellingAreaMap: SellingAreaMapRepository,
  ) {}

  async execute(module: string, showAll: boolean): Promise<Location[]> {
    const locations = await this.repository.getAll(module, showAll);

    if (module === "replenishment") {
      const feederNames = await this.sellingAreaMap.getSellingAreaFeederNames();
      return locations.map((loc) => ({
        ...loc,
        fedByFeederName: feederNames.get(loc.id) ?? null,
      }));
    }

    return locations;
  }
}
