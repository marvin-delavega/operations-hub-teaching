import type { LocationRepository } from "../domain/LocationRepository";
import type { Location } from "../domain/Location";
import { visibilityStore } from "./seedVisibilityStore";

const SEED_LOCATIONS: { id: number; name: string }[] = [
  { id: 1, name: "Cold Storage" },
  { id: 2, name: "Main Warehouse" },
  { id: 3, name: "Overflow Storage" },
  { id: 4, name: "Selling Area" },
];

export class SeedLocationRepository implements LocationRepository {
  async getAll(module: string, showAll: boolean): Promise<Location[]> {
    const locations: Location[] = SEED_LOCATIONS.map((loc) => ({
      ...loc,
      hidden: visibilityStore.get(`${module}:${loc.id}`) ?? false,
    }));

    const filtered = showAll ? locations : locations.filter((l) => !l.hidden);
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getById(id: number): Promise<Location | null> {
    const loc = SEED_LOCATIONS.find((l) => l.id === id);
    if (!loc) return null;
    return { ...loc, hidden: false };
  }
}
