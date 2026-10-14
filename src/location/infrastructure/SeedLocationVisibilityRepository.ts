import type { LocationVisibilityRepository } from "../domain/LocationVisibilityRepository";
import { visibilityStore } from "./seedVisibilityStore";

export class SeedLocationVisibilityRepository implements LocationVisibilityRepository {
  async setHidden(module: string, locationId: number, hidden: boolean): Promise<void> {
    const key = `${module}:${locationId}`;
    if (hidden) {
      visibilityStore.set(key, true);
    } else {
      visibilityStore.delete(key);
    }
  }
}
